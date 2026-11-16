import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { createServer as createViteServer } from 'vite';
import 'dotenv/config';

const PORT = 3000;
const ROOT_DIR = process.cwd();
const ANDROID_DIR = path.join(ROOT_DIR, 'android-project');
const FIRMWARE_DIR = path.join(ROOT_DIR, 'esp32-firmware');

const COOKIE_NAME = 'minicast_gh_sid';
const ghSessions = new Map<string, { token: string; login: string; avatarUrl: string; name: string }>();
const oauthStates = new Set<string>();

interface ProjectFileEntry {
  category: 'android' | 'firmware';
  relativePath: string;
  content: string;
  sizeBytes: number;
}

function collectFiles(baseDir: string, category: 'android' | 'firmware', currentDir = baseDir): ProjectFileEntry[] {
  if (!fs.existsSync(currentDir)) return [];
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });
  const results: ProjectFileEntry[] = [];

  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(baseDir, category, fullPath));
    } else if (entry.isFile()) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const relativePath = path.relative(baseDir, fullPath).split(path.sep).join('/');
      results.push({
        category,
        relativePath,
        content,
        sizeBytes: Buffer.byteLength(content, 'utf-8'),
      });
    }
  }
  return results.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  cookieHeader.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx > 0) {
      const k = part.slice(0, idx).trim();
      const v = part.slice(idx + 1).trim();
      out[k] = decodeURIComponent(v);
    }
  });
  return out;
}

function getAppBaseUrl(): string {
  const raw = process.env.APP_URL;
  if (raw && raw !== 'MY_APP_URL') {
    return raw.replace(/\/+$/, '');
  }
  return `http://localhost:${PORT}`;
}

function isOAuthConfigured(): boolean {
  const cid = process.env.GITHUB_CLIENT_ID;
  const csec = process.env.GITHUB_CLIENT_SECRET;
  return Boolean(cid && csec && cid !== 'MY_GITHUB_CLIENT_ID' && csec !== 'MY_GITHUB_CLIENT_SECRET');
}

async function githubFetch(url: string, token: string, init: RequestInit = {}) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'ESP32-MiniCast-Studio',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { message: text };
  }
  if (!res.ok) {
    const errMsg = (json as { message?: string } | null)?.message || `GitHub API error (${res.status})`;
    throw new Error(errMsg);
  }
  return json;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/deliverables', (_req, res) => {
    try {
      const androidFiles = collectFiles(ANDROID_DIR, 'android');
      const firmwareFiles = collectFiles(FIRMWARE_DIR, 'firmware');
      res.json({
        androidFiles,
        firmwareFiles,
        apkBuildStatus: {
          canCompileInSandbox: false,
          reason:
            'This web runtime container does not include JDK or Android SDK/Gradle. Push to GitHub to run the included GitHub Actions APK workflow, or open android-project/ESP32MiniCast locally in Android Studio.',
        },
      });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/download-bundle', async (req, res) => {
    try {
      const target = String(req.query.target || 'all');
      const zip = new JSZip();

      if (target === 'all' || target === 'android') {
        const androidFiles = collectFiles(ANDROID_DIR, 'android');
        for (const f of androidFiles) {
          zip.file(`android-project/${f.relativePath}`, f.content);
        }
      }
      if (target === 'all' || target === 'firmware') {
        const firmwareFiles = collectFiles(FIRMWARE_DIR, 'firmware');
        for (const f of firmwareFiles) {
          zip.file(`esp32-firmware/${f.relativePath}`, f.content);
        }
      }

      const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
      const filename =
        target === 'android'
          ? 'ESP32-MiniCast-Android-Studio.zip'
          : target === 'firmware'
            ? 'ESP32-MiniCast-Firmware.zip'
            : 'ESP32-MiniCast-Complete-Bundle.zip';

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // GitHub OAuth status & URL endpoints
  app.get('/api/github/status', (req, res) => {
    const cookies = parseCookies(req.headers.cookie);
    const sid = cookies[COOKIE_NAME];
    const session = sid ? ghSessions.get(sid) : undefined;
    const baseUrl = getAppBaseUrl();
    res.json({
      configured: isOAuthConfigured(),
      connected: Boolean(session),
      user: session
        ? { login: session.login, avatarUrl: session.avatarUrl, name: session.name }
        : null,
      callbackUrl: `${baseUrl}/auth/github/callback`,
    });
  });

  app.get('/api/github/auth/url', (_req, res) => {
    if (!isOAuthConfigured()) {
      res.status(400).json({
        error: 'GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET are not configured in AI Studio Secrets yet.',
        callbackUrl: `${getAppBaseUrl()}/auth/github/callback`,
      });
      return;
    }

    const state = crypto.randomBytes(16).toString('hex');
    oauthStates.add(state);
    const redirectUri = `${getAppBaseUrl()}/auth/github/callback`;
    const params = new URLSearchParams({
      client_id: process.env.GITHUB_CLIENT_ID!,
      redirect_uri: redirectUri,
      scope: 'repo read:user',
      state,
    });
    res.json({ url: `https://github.com/login/oauth/authorize?${params.toString()}` });
  });

  app.post('/api/github/logout', (req, res) => {
    const cookies = parseCookies(req.headers.cookie);
    const sid = cookies[COOKIE_NAME];
    if (sid) ghSessions.delete(sid);
    res.clearCookie(COOKIE_NAME, { sameSite: 'none', secure: true, httpOnly: true });
    res.json({ ok: true });
  });

  // OAuth callback handler (handles both /auth/github/callback and trailing slash)
  app.get(['/auth/github/callback', '/auth/github/callback/'], async (req, res) => {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';

    if (!code || !state || !oauthStates.has(state)) {
      res.status(400).send('<html><body><p>Invalid or expired GitHub OAuth state.</p></body></html>');
      return;
    }
    oauthStates.delete(state);

    try {
      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: `${getAppBaseUrl()}/auth/github/callback`,
        }),
      });
      const tokenData = (await tokenRes.json()) as { access_token?: string; error_description?: string };
      if (!tokenData.access_token) {
        throw new Error(tokenData.error_description || 'Failed to exchange code for GitHub access token');
      }

      const user = (await githubFetch('https://api.github.com/user', tokenData.access_token)) as {
        login: string;
        avatar_url: string;
        name: string | null;
      };

      const sid = crypto.randomUUID();
      ghSessions.set(sid, {
        token: tokenData.access_token,
        login: user.login,
        avatarUrl: user.avatar_url,
        name: user.name || user.login,
      });

      res.cookie(COOKIE_NAME, sid, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 1000 * 60 * 60 * 12,
      });

      res.send(`<!doctype html>
<html>
  <body style="background:#0B0E14;color:#F1F5F9;font-family:system-ui,sans-serif;padding:24px;">
    <script>
      if (window.opener) {
        window.opener.postMessage({ type: 'GITHUB_OAUTH_SUCCESS', login: ${JSON.stringify(user.login)} }, '*');
        window.close();
      } else {
        window.location.href = '/';
      }
    </script>
    <p>Connected to GitHub as ${user.login}. You may close this window.</p>
  </body>
</html>`);
    } catch (err) {
      res
        .status(500)
        .send(`<html><body><p>GitHub OAuth failed: ${(err as Error).message}</p></body></html>`);
    }
  });

  // Push complete ESP32 MiniCast project to GitHub repository via Git Data API
  app.post('/api/github/push', async (req, res) => {
    const cookies = parseCookies(req.headers.cookie);
    const sid = cookies[COOKIE_NAME];
    const session = sid ? ghSessions.get(sid) : undefined;
    if (!session) {
      res.status(401).json({ error: 'Not authenticated with GitHub.' });
      return;
    }

    const repoName = String(req.body?.repoName || 'esp32-minicast')
      .trim()
      .replace(/[^a-zA-Z0-9._-]/g, '-');
    const isPrivate = Boolean(req.body?.isPrivate ?? false);

    if (!repoName) {
      res.status(400).json({ error: 'Repository name is required.' });
      return;
    }

    try {
      let repo: { full_name: string; html_url: string; default_branch: string };
      try {
        repo = (await githubFetch(
          `https://api.github.com/repos/${session.login}/${repoName}`,
          session.token
        )) as typeof repo;
      } catch {
        repo = (await githubFetch('https://api.github.com/user/repos', session.token, {
          method: 'POST',
          body: JSON.stringify({
            name: repoName,
            description: 'ESP32 MiniCast — Interactive Robotic Eye, Bluetooth Classic SPP Firmware & Android Jetpack Compose App',
            private: isPrivate,
            auto_init: true,
          }),
        })) as typeof repo;
        // Allow GitHub to finish initializing the initial commit
        await new Promise((r) => setTimeout(r, 1200));
      }

      const branch = repo.default_branch || 'main';
      const refData = (await githubFetch(
        `https://api.github.com/repos/${repo.full_name}/git/ref/heads/${branch}`,
        session.token
      )) as { object: { sha: string } };

      const parentCommitSha = refData.object.sha;
      const parentCommit = (await githubFetch(
        `https://api.github.com/repos/${repo.full_name}/git/commits/${parentCommitSha}`,
        session.token
      )) as { tree: { sha: string } };

      const androidFiles = collectFiles(ANDROID_DIR, 'android');
      const firmwareFiles = collectFiles(FIRMWARE_DIR, 'firmware');

      const filesToPush: Array<{ path: string; content: string }> = [
        ...androidFiles.map((f) => ({
          path: f.relativePath.startsWith('.github/')
            ? f.relativePath
            : `android-project/${f.relativePath}`,
          content: f.content,
        })),
        ...firmwareFiles.map((f) => ({
          path: `esp32-firmware/${f.relativePath}`,
          content: f.content,
        })),
      ];

      // Also expose root .github/workflows/build-apk.yml so GitHub Actions triggers automatically
      const workflowFile = androidFiles.find((f) => f.relativePath.endsWith('build-apk.yml'));
      if (workflowFile) {
        filesToPush.push({
          path: '.github/workflows/build-apk.yml',
          content: workflowFile.content,
        });
      }

      // Create blobs in parallel batches of 6
      const treeEntries: Array<{ path: string; mode: string; type: string; sha: string }> = [];
      for (let i = 0; i < filesToPush.length; i += 6) {
        const batch = filesToPush.slice(i, i + 6);
        const blobs = await Promise.all(
          batch.map(async (file) => {
            const created = (await githubFetch(
              `https://api.github.com/repos/${repo.full_name}/git/blobs`,
              session.token,
              {
                method: 'POST',
                body: JSON.stringify({ content: file.content, encoding: 'utf-8' }),
              }
            )) as { sha: string };
            return {
              path: file.path,
              mode: '100644',
              type: 'blob',
              sha: created.sha,
            };
          })
        );
        treeEntries.push(...blobs);
      }

      const newTree = (await githubFetch(
        `https://api.github.com/repos/${repo.full_name}/git/trees`,
        session.token,
        {
          method: 'POST',
          body: JSON.stringify({
            base_tree: parentCommit.tree.sha,
            tree: treeEntries,
          }),
        }
      )) as { sha: string };

      const newCommit = (await githubFetch(
        `https://api.github.com/repos/${repo.full_name}/git/commits`,
        session.token,
        {
          method: 'POST',
          body: JSON.stringify({
            message: 'Push ESP32 MiniCast Android Studio project, ESP32 firmware & APK workflow',
            tree: newTree.sha,
            parents: [parentCommitSha],
          }),
        }
      )) as { sha: string };

      await githubFetch(
        `https://api.github.com/repos/${repo.full_name}/git/refs/heads/${branch}`,
        session.token,
        {
          method: 'PATCH',
          body: JSON.stringify({ sha: newCommit.sha, force: false }),
        }
      );

      res.json({
        ok: true,
        repoUrl: repo.html_url,
        fullName: repo.full_name,
        commitSha: newCommit.sha,
        filesCount: filesToPush.length,
        actionsUrl: `${repo.html_url}/actions`,
      });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(ROOT_DIR, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ESP32 MiniCast server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
