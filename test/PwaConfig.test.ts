import { describe, it, expect } from 'vitest';
import configContent from '../vite.config.ts?raw';

describe('PWA Workbox Audio & Font Caching Configuration', () => {
  it('defines globPatterns including audio, icon, and font asset extensions', () => {
    expect(configContent).toContain("**/*.{js,css,html,ico,png,svg,ogg,wav,mp3,json}");
  });

  it('defines runtimeCaching for Google Fonts stylesheets and webfonts', () => {
    expect(configContent).toContain('google-fonts-stylesheets');
    expect(configContent).toContain('google-fonts-webfonts');
  });

  it('defines runtimeCaching for audio requests with required LRU bounds and rangeRequests', () => {
    expect(configContent).toContain('audio-cache');
    expect(configContent).toContain("request.destination === 'audio'");
    expect(configContent).toContain('maxEntries: 100');
    expect(configContent).toContain('maxAgeSeconds: 30 * 24 * 60 * 60');
    expect(configContent).toContain('purgeOnQuotaError: true');
    expect(configContent).toContain('rangeRequests: true');
  });

  it('defines PWABuilder compliant manifest properties', () => {
    expect(configContent).toContain("id: '/'");
    expect(configContent).toContain("start_url: '/'");
    expect(configContent).toContain("scope: '/'");
    expect(configContent).toContain("categories: ['education', 'kids', 'games']");
    expect(configContent).toContain("purpose: 'any maskable'");
  });
});
