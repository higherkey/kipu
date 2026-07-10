import { vi } from 'vitest';

vi.mock('@capacitor/haptics', () => {
  return {
    Haptics: {
      vibrate: vi.fn(({ duration }) => {
        if (navigator.vibrate) navigator.vibrate(duration || 200);
        return Promise.resolve();
      }),
      impact: vi.fn(({ style }) => {
        const duration = style === 'HEAVY' ? 50 : 20;
        if (navigator.vibrate) navigator.vibrate(duration);
        return Promise.resolve();
      }),
      notification: vi.fn(({ type }) => {
        if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
        return Promise.resolve();
      }),
    },
    ImpactStyle: {
      Light: 'LIGHT',
      Medium: 'MEDIUM',
      Heavy: 'HEAVY',
    },
    NotificationType: {
      Success: 'SUCCESS',
      Warning: 'WARNING',
      Error: 'ERROR',
    }
  };
});
