import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // ВАЖНО: appId нельзя менять после публикации в Google Play. Решите сейчас.
  appId: 'com.otarbayramazan.habits',
  appName: 'Habits',
  webDir: 'dist',
  android: {
    backgroundColor: '#000000',
  },
  plugins: {
    LocalNotifications: {
      iconColor: '#f97316',
    },
  },
};

export default config;
