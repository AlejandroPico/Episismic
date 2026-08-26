export const APP_VERSION = '1.2.2';
export const RELEASES_URL = 'https://github.com/AlejandroPico/Episismic/releases';

export type DesktopPlatform = 'windows' | 'macos' | 'linux' | 'unknown';
export type DesktopArchitecture = 'x64' | 'arm64' | 'unknown';

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

export function detectDesktopArchitecture(): DesktopArchitecture {
  const description = `${navigator.userAgent} ${navigator.platform}`.toLowerCase();
  if (/arm64|aarch64/.test(description)) return 'arm64';
  if (/x86_64|x64|amd64|win64/.test(description) && !description.includes('macintel')) return 'x64';
  return 'unknown';
}

export function isNewerVersion(candidate: string, current = APP_VERSION) {
  const parts = (version: string) => version.replace(/^v/, '').split(/[.-]/).slice(0, 3).map((value) => Number.parseInt(value, 10) || 0);
  const next = parts(candidate);
  const installed = parts(current);
  return next.some((value, index) => value > installed[index] && next.slice(0, index).every((part, partIndex) => part === installed[partIndex]));
}

export function assetForPlatform(release: LatestRelease, platform = detectDesktopPlatform(), architecture?: DesktopArchitecture) {
  if (platform === 'macos') {
    const resolvedArchitecture = architecture ?? detectDesktopArchitecture();
    if (resolvedArchitecture === 'arm64') return release.assets.find((asset) => /_aarch64\.dmg$/i.test(asset.name)) || null;
    if (resolvedArchitecture === 'x64') return release.assets.find((asset) => /_x64\.dmg$/i.test(asset.name)) || null;
    return null;
  }
  const extensions: Record<DesktopPlatform, RegExp[]> = {
    windows: [/setup\.exe$/i, /\.msi$/i],
    macos: [],
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
    const response = await fetch('https://api.github.com/repos/AlejandroPico/Episismic/releases?per_page=1', {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`GitHub Releases respondió ${response.status}`);
    const releases = await response.json() as Array<{
      tag_name: string; name: string; html_url: string; published_at: string; body: string; assets: ReleaseAsset[];
    }>;
    const data = releases[0];
    if (!data) return null;
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
