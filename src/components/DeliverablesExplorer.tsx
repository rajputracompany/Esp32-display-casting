import React, { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Cpu, Download, ExternalLink, FileCode2, FolderTree, GitBranch, Loader2, LogOut, Smartphone } from 'lucide-react';
import { ProjectFileEntry } from '../types/minicast';

interface DeliverablesResponse {
  androidFiles: ProjectFileEntry[];
  firmwareFiles: ProjectFileEntry[];
  apkBuildStatus: {
    canCompileInSandbox: boolean;
    reason: string;
  };
}

interface GitHubStatusResponse {
  configured: boolean;
  connected: boolean;
  user: {
    login: string;
    avatarUrl: string;
    name: string;
  } | null;
  callbackUrl: string;
}

interface GitHubPushResult {
  repoUrl: string;
  fullName: string;
  commitSha: string;
  filesCount: number;
  actionsUrl: string;
}

export const DeliverablesExplorer: React.FC = () => {
  const [data, setData] = useState<DeliverablesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<'android' | 'firmware'>('android');
  const [selectedPath, setSelectedPath] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  // GitHub OAuth & Push state
  const [ghStatus, setGhStatus] = useState<GitHubStatusResponse | null>(null);
  const [ghError, setGhError] = useState<string | null>(null);
  const [repoName, setRepoName] = useState('esp32-minicast');
  const [isPrivateRepo, setIsPrivateRepo] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [pushResult, setPushResult] = useState<GitHubPushResult | null>(null);

  const refreshGitHubStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/github/status');
      if (res.ok) {
        const json = (await res.json()) as GitHubStatusResponse;
        setGhStatus(json);
      }
    } catch {
      // Ignore network error on initial check
    }
  }, []);

  useEffect(() => {
    refreshGitHubStatus();
  }, [refreshGitHubStatus]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (
        !origin.endsWith('.run.app') &&
        !origin.includes('localhost') &&
        origin !== window.location.origin
      ) {
        return;
      }
      if (event.data?.type === 'GITHUB_OAUTH_SUCCESS') {
        setGhError(null);
        refreshGitHubStatus();
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [refreshGitHubStatus]);

  useEffect(() => {
    fetch('/api/deliverables')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json: DeliverablesResponse) => {
        setData(json);
        if (json.androidFiles.length > 0) {
          const main = json.androidFiles.find((f) => f.relativePath.endsWith('MainActivity.kt')) || json.androidFiles[0];
          setSelectedPath(main.relativePath);
        }
        setLoading(false);
      })
      .catch((err) => {
        setError((err as Error).message);
        setLoading(false);
      });
  }, []);

  const handleConnectGitHub = async () => {
    setGhError(null);
    try {
      const res = await fetch('/api/github/auth/url');
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        setGhError(json.error || 'Could not start GitHub OAuth flow.');
        return;
      }
      const popup = window.open(json.url, 'github_oauth_popup', 'width=620,height=720');
      if (!popup) {
        setGhError('Popup was blocked by your browser. Allow popups for this site and try again.');
      }
    } catch (err) {
      setGhError((err as Error).message);
    }
  };

  const handleDisconnectGitHub = async () => {
    await fetch('/api/github/logout', { method: 'POST' });
    setPushResult(null);
    refreshGitHubStatus();
  };

  const handlePushToGitHub = async () => {
    setGhError(null);
    setIsPushing(true);
    setPushResult(null);
    try {
      const res = await fetch('/api/github/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoName, isPrivate: isPrivateRepo }),
      });
      const json = (await res.json()) as GitHubPushResult & { error?: string };
      if (!res.ok) {
        throw new Error(json.error || 'Failed to push repository to GitHub.');
      }
      setPushResult(json);
    } catch (err) {
      setGhError((err as Error).message);
    } finally {
      setIsPushing(false);
    }
  };

  const currentList = data ? (scope === 'android' ? data.androidFiles : data.firmwareFiles) : [];
  const activeFile = currentList.find((f) => f.relativePath === selectedPath) || currentList[0] || null;

  const handleCopy = async () => {
    if (!activeFile) return;
    await navigator.clipboard.writeText(activeFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="space-y-6">
      {/* Header & Download Actions */}
      <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
        <div className="flex flex-col justify-between rounded-2xl border border-[#1E2534] bg-[#12161F] p-6 lg:col-span-7">
          <div>
            <h2 className="text-xl font-semibold text-slate-100">
              Complete Android Studio Project & ESP32 Firmware
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Every Kotlin Jetpack Compose file, Gradle build script, AndroidManifest, JUnit test, and matching
              ESP32-WROOM-32 BluetoothSerial firmware file is generated on disk and ready to download or push to GitHub.
            </p>
            {data?.apkBuildStatus && (
              <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs leading-relaxed text-amber-200">
                <strong className="font-semibold">APK Build Note:</strong> {data.apkBuildStatus.reason}
              </p>
            )}
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <a
              href="/api/download-bundle?target=all"
              className="flex min-h-[44px] items-center gap-2 rounded-xl bg-cyan-400 px-5 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-300 whitespace-nowrap"
            >
              <Download className="h-4 w-4" />
              Download Complete Bundle (.zip)
            </a>
            <a
              href="/api/download-bundle?target=android"
              className="flex min-h-[44px] items-center gap-2 rounded-xl border border-[#232B3D] bg-[#0D1119] px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:border-cyan-400/50 whitespace-nowrap"
            >
              <Smartphone className="h-4 w-4 text-cyan-400" />
              Android Studio Only
            </a>
            <a
              href="/api/download-bundle?target=firmware"
              className="flex min-h-[44px] items-center gap-2 rounded-xl border border-[#232B3D] bg-[#0D1119] px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:border-cyan-400/50 whitespace-nowrap"
            >
              <Cpu className="h-4 w-4 text-cyan-400" />
              ESP32 Firmware Only
            </a>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#1E2534] bg-[#12161F] lg:col-span-5">
          {!imgFailed ? (
            <img
              src="/src/assets/images/minicast_hardware_setup_1794766714350.jpg"
              alt="ESP32 DevKit V1 wired to 1-inch SSD1306 128x64 OLED and 18650 battery"
              referrerPolicy="no-referrer"
              onError={() => setImgFailed(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full min-h-[220px] flex-col items-center justify-center bg-[#0D1119] p-6 text-center">
              <Cpu className="h-8 w-8 text-cyan-400" />
              <p className="mt-2 text-sm font-medium text-slate-200">ESP32 DevKit V1 + SSD1306 OLED</p>
              <p className="mt-1 font-mono text-xs text-slate-400">SDA GPIO 21 · SCL GPIO 22 · 18650 Cell</p>
            </div>
          )}
        </div>
      </div>

      {/* Connect to GitHub & Push Repository + Cloud APK Build */}
      <div className="rounded-2xl border border-[#1E2534] bg-[#12161F] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-100">GitHub Repository & Automated APK Build</h3>
            <p className="mt-0.5 text-xs text-slate-400">
              Connect your GitHub account to push the Android Studio project, ESP32 firmware, and GitHub Actions APK workflow.
            </p>
          </div>

          {ghStatus?.connected && ghStatus.user ? (
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-cyan-300">@{ghStatus.user.login}</span>
              <button
                type="button"
                onClick={handleDisconnectGitHub}
                className="flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[#232B3D] bg-[#0D1119] px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-slate-500"
              >
                <LogOut className="h-3.5 w-3.5" />
                Disconnect
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleConnectGitHub}
              className="flex min-h-[42px] items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2 text-xs font-semibold text-slate-950 transition-colors hover:bg-cyan-300 whitespace-nowrap"
            >
              <GitBranch className="h-4 w-4" />
              Connect to GitHub
            </button>
          )}
        </div>

        {ghError && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
            {ghError}
          </div>
        )}

        {!ghStatus?.configured && (
          <div className="rounded-xl border border-[#1E2534] bg-[#0D1119] p-4 text-xs leading-relaxed text-slate-400 space-y-1.5">
            <p className="font-medium text-slate-200">GitHub OAuth App Setup (AI Studio Secrets)</p>
            <p>
              1. Create an OAuth App in GitHub Developer Settings with callback URL:{' '}
              <span className="font-mono text-cyan-300">{ghStatus?.callbackUrl || 'Loading...'}</span>
            </p>
            <p>
              2. Add <span className="font-mono text-slate-200">GITHUB_CLIENT_ID</span> and{' '}
              <span className="font-mono text-slate-200">GITHUB_CLIENT_SECRET</span> in AI Studio Secrets, then click{' '}
              <strong className="text-slate-200">Connect to GitHub</strong>.
            </p>
          </div>
        )}

        {ghStatus?.connected && (
          <div className="flex flex-wrap items-end gap-3 border-t border-[#1E2534] pt-4">
            <div className="min-w-[200px] flex-1">
              <label htmlFor="gh-repo-name" className="block text-xs font-medium text-slate-300">
                Repository Name
              </label>
              <input
                id="gh-repo-name"
                type="text"
                value={repoName}
                onChange={(e) => setRepoName(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-[#232B3D] bg-[#0B0E14] px-3.5 py-2 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <label className="flex min-h-[40px] cursor-pointer items-center gap-2 rounded-xl border border-[#232B3D] bg-[#0D1119] px-3.5 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={isPrivateRepo}
                onChange={(e) => setIsPrivateRepo(e.target.checked)}
                className="accent-cyan-400"
              />
              Private Repository
            </label>

            <button
              type="button"
              disabled={isPushing || !repoName.trim()}
              onClick={handlePushToGitHub}
              className="flex min-h-[42px] items-center gap-2 rounded-xl bg-cyan-400 px-5 py-2 text-xs font-semibold text-slate-950 transition-colors hover:bg-cyan-300 disabled:opacity-60 whitespace-nowrap"
            >
              {isPushing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Pushing Files...
                </>
              ) : (
                <>
                  <GitBranch className="h-4 w-4" />
                  Push Project to GitHub
                </>
              )}
            </button>
          </div>
        )}

        {pushResult && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-200">
            <span>
              Pushed <strong>{pushResult.filesCount}</strong> files to{' '}
              <span className="font-mono">{pushResult.fullName}</span> ({pushResult.commitSha.slice(0, 7)})
            </span>
            <div className="flex items-center gap-4">
              <a
                href={pushResult.repoUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-emerald-300 hover:underline"
              >
                Open Repo <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <a
                href={pushResult.actionsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-cyan-300 hover:underline"
              >
                View APK Action <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Hardware Wiring Quick Table */}
      <div className="rounded-2xl border border-[#1E2534] bg-[#12161F] p-5">
        <h3 className="text-base font-semibold text-slate-100">Hardware Wiring & Build Commands</h3>
        <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#1E2534] text-slate-400">
                  <th className="py-2 pr-4 font-medium">SSD1306 Pin</th>
                  <th className="py-2 pr-4 font-medium">ESP32-WROOM-32</th>
                  <th className="py-2 font-medium">Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E2534]/60 font-mono tabular-nums text-slate-200">
                <tr>
                  <td className="py-2 pr-4">VCC</td>
                  <td className="py-2 pr-4 text-cyan-300">3V3</td>
                  <td className="py-2 font-sans text-slate-400">3.3V Regulated Power</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">GND</td>
                  <td className="py-2 pr-4 text-cyan-300">GND</td>
                  <td className="py-2 font-sans text-slate-400">Common Ground</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">SDA</td>
                  <td className="py-2 pr-4 text-cyan-300">GPIO 21</td>
                  <td className="py-2 font-sans text-slate-400">I2C Data (0x3C)</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">SCL</td>
                  <td className="py-2 pr-4 text-cyan-300">GPIO 22</td>
                  <td className="py-2 font-sans text-slate-400">I2C Clock</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="space-y-2 rounded-xl border border-[#1E2534] bg-[#0B0E14] p-4 font-mono text-xs text-slate-300">
            <p className="text-slate-400"># Build Android Debug APK locally</p>
            <p className="text-cyan-300">cd android-project/ESP32MiniCast && ./gradlew assembleDebug</p>
            <p className="pt-2 text-slate-400"># Flash ESP32-WROOM-32 via PlatformIO</p>
            <p className="text-cyan-300">cd esp32-firmware && pio run -t upload</p>
          </div>
        </div>
      </div>

      {/* File Browser & Code Viewer */}
      <div className="rounded-2xl border border-[#1E2534] bg-[#12161F] overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1E2534] px-5 py-3.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setScope('android');
                if (data?.androidFiles[0]) setSelectedPath(data.androidFiles[0].relativePath);
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                scope === 'android'
                  ? 'bg-cyan-400/15 text-cyan-300'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              Android Studio ({data?.androidFiles.length ?? 0} files)
            </button>
            <button
              type="button"
              onClick={() => {
                setScope('firmware');
                if (data?.firmwareFiles[0]) setSelectedPath(data.firmwareFiles[0].relativePath);
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                scope === 'firmware'
                  ? 'bg-cyan-400/15 text-cyan-300'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              ESP32 Firmware ({data?.firmwareFiles.length ?? 0} files)
            </button>
          </div>

          {activeFile && (
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-lg border border-[#232B3D] bg-[#0D1119] px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-cyan-400/50"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy File'}
            </button>
          )}
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading project deliverables...</div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-rose-400">Failed to load deliverables: {error}</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12">
            <div className="max-h-[520px] overflow-y-auto border-b border-[#1E2534] bg-[#0D1119] p-3 lg:col-span-4 lg:border-b-0 lg:border-r">
              <div className="mb-2 flex items-center gap-2 px-2 text-xs font-medium text-slate-400">
                <FolderTree className="h-3.5 w-3.5" />
                Project Explorer
              </div>
              <div className="space-y-0.5">
                {currentList.map((file) => {
                  const isSel = activeFile?.relativePath === file.relativePath;
                  return (
                    <button
                      key={file.relativePath}
                      type="button"
                      onClick={() => setSelectedPath(file.relativePath)}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
                        isSel
                          ? 'bg-cyan-400/15 font-medium text-cyan-300'
                          : 'text-slate-300 hover:bg-slate-800/60'
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <FileCode2 className="h-3.5 w-3.5 shrink-0 opacity-70" />
                        <span className="truncate font-mono text-[11px]">{file.relativePath}</span>
                      </span>
                      <span className="shrink-0 font-mono text-[10px] text-slate-500 tabular-nums">
                        {(file.sizeBytes / 1024).toFixed(1)}K
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="max-h-[520px] overflow-auto bg-[#080B10] p-4 lg:col-span-8">
              {activeFile ? (
                <pre className="font-mono text-xs leading-relaxed text-slate-200">
                  <code>{activeFile.content}</code>
                </pre>
              ) : (
                <p className="text-xs text-slate-400">Select a file to inspect its source code.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
