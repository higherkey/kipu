import { describe, it, expect, beforeEach } from 'vitest';
import { AuthService } from '../src/core/AuthService';
import { NeonClient } from '../src/core/NeonClient';

describe('AuthService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('initializes with unauthenticated state when storage is empty', () => {
    const auth = AuthService.getInstance();
    expect(auth.getState().isAuthenticated).toBe(false);
    expect(auth.getState().user).toBeNull();
  });

  it('allows guest login and persists user session', async () => {
    const auth = AuthService.getInstance();
    const guest = await auth.signInGuest('Inti');
    expect(guest.name).toBe('Inti');
    expect(auth.getState().isAuthenticated).toBe(true);
    expect(auth.getState().user?.name).toBe('Inti');
  });

  it('allows email login', async () => {
    const auth = AuthService.getInstance();
    const user = await auth.signInWithEmail('student@example.com', 'Killa');
    expect(user.email).toBe('student@example.com');
    expect(user.name).toBe('Killa');
    expect(auth.getState().isAuthenticated).toBe(true);
  });

  it('clears session on sign out', async () => {
    const auth = AuthService.getInstance();
    await auth.signInGuest('Pacha');
    expect(auth.getState().isAuthenticated).toBe(true);
    await auth.signOut();
    expect(auth.getState().isAuthenticated).toBe(false);
    expect(auth.getState().user).toBeNull();
  });
});

describe('NeonClient', () => {
  it('exposes client instance and configuration status', () => {
    const neonClient = NeonClient.getInstance();
    expect(typeof neonClient.isConfigured()).toBe('boolean');
  });

  it('safely handles queries and returns array', async () => {
    const neonClient = NeonClient.getInstance();
    const res = await neonClient.query('SELECT 1 as test');
    expect(Array.isArray(res)).toBe(true);
  });
});
