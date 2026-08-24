import { describe, expect, it } from 'vitest';
import { assetForPlatform, isNewerVersion, type LatestRelease } from './releases';

const release: LatestRelease = {
  version: '0.10.0', name: 'Episismic 0.10.0', url: 'https://example.test/release', publishedAt: '', notes: '',
  assets: [
    { name: 'Episismic_0.10.0_x64-setup.exe', browser_download_url: 'https://example.test/windows', size: 10 },
    { name: 'Episismic_0.10.0_x64.dmg', browser_download_url: 'https://example.test/macos', size: 20 },
    { name: 'Episismic_0.10.0_amd64.AppImage', browser_download_url: 'https://example.test/linux', size: 30 },
  ],
};

describe('versionado de escritorio', () => {
  it('compara versiones semánticas numéricamente', () => {
    expect(isNewerVersion('0.10.0', '0.9.9')).toBe(true);
    expect(isNewerVersion('1.0.0', '0.9.9')).toBe(true);
    expect(isNewerVersion('0.8.9', '0.9.0')).toBe(false);
    expect(isNewerVersion('0.9.0', '0.9.0')).toBe(false);
  });

  it('elige el instalador correspondiente al sistema', () => {
    expect(assetForPlatform(release, 'windows')?.browser_download_url).toContain('windows');
    expect(assetForPlatform(release, 'macos')?.browser_download_url).toContain('macos');
    expect(assetForPlatform(release, 'linux')?.browser_download_url).toContain('linux');
  });
});
