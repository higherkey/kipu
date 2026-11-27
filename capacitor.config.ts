import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sitewright.kipu',
  appName: 'Kipu',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
