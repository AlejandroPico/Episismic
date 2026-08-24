export const APP_VERSION = '0.9.0';
export const RELEASES_URL = 'https://github.com/AlejandroPico/Episismic/releases/latest';

export type DesktopPlatform = 'windows' | 'macos' | 'linux' | 'unknown';

export interface ReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

export interface LatestRelease {
  version: string;
  name: string;
  url: string;
  publishedAt: string;
  notes: string;
  assets: ReleaseAsset[];
}

const CACHE_KEY = 'episismic:latest-release-v1';
const CACHE_TIME = 30 * 60_000;

export function isNativeApp() {
  return '__TAURI_INTERNALS__' in window;
}

export function detectDesktopPlatform(): DesktopPlatform {
  const platform = `${navigator.userAgent} ${navigator.platform}`.toLowerCase();
  if (platform.includes('win')) return 'windows';
  if (platform.includes('mac')) return 'macos';
  if (platform.includes('linux') || platform.includes('x11')) return 'linux';
  return 'unknown';
}

export function platformLabel(platform = detectDesktopPlatform()) {
  return ({ windows: 'Windows', macos: 'macOS', linux: 'Linux', unknown: 'escritorio' })[platform];
}

export function isNewerVersion(candidate: string, current = APP_VERSION) {
  const parts = (version: string) => version.replace(/^v/, '').split(/[.-]/).slice(0, 3).map((value) => Number.parseInt(value, 10) || 0);
  const next = parts(candidate);
  const installed = parts(current);
  return next.some((value, index) => value > installed[index] && next.slice(0, index).every((part, partIndex) => part === installed[partIndex]));
}

export function assetForPlatform(release: LatestRelease, platform = detectDesktopPlatform()) {
  const extensions: Record<DesktopPlatform, RegExp[]> = {
    windows: [/setup\.exe$/i, /\.msi$/i],
    macos: [/\.dmg$/i, /\.app\.tar\.gz$/i],
    linux: [/\.AppImage$/i, /\.deb$/i],
    unknown: [],
  };
  for (const expression of extensions[platform]) {
    const match = release.assets.find((asset) => expression.test(asset.name));
    if (match) return match;
  }
  return null;
}

export async function fetchLatestRelease(force = false): Promise<LatestRelease | null> {
  if (!force) {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null') as { savedAt: number; release: LatestRelease | null } | null;
      if (cached && Date.now() - cached.savedAt < CACHE_TIME) return cached.release;
    } catch { /* La consulta directa sigue disponible. */ }
  }
  try {
    const response = await fetch('https://api.github.com/repos/AlejandroPico/Episismic/releases/latest', {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`GitHub Releases respondió ${response.status}`);
    const data = await response.json() as {
      tag_name: string; name: string; html_url: string; published_at: string; body: string; assets: ReleaseAsset[];
    };
    const release: LatestRelease = {
      version: data.tag_name.replace(/^v/, ''),
      name: data.name || data.tag_name,
      url: data.html_url,
      publishedAt: data.published_at,
      notes: data.body || '',
      assets: data.assets || [],
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), release }));
    return release;
  } catch {
    return null;
  }
}
