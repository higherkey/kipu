export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  createdAt: number;
}

export interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export type AuthListener = (state: AuthState) => void;

export class AuthService {
  private static instance: AuthService;
  private state: AuthState = {
    user: null,
    isAuthenticated: false,
    isLoading: true,
  };
  private listeners: Set<AuthListener> = new Set();
  private readonly storageKey = 'kipu_user_session';

  private constructor() {
    this.restoreSession();
  }

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  private restoreSession(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const user = JSON.parse(stored) as UserProfile;
        this.state = {
          user,
          isAuthenticated: true,
          isLoading: false,
        };
      } else {
        this.state = {
          user: null,
          isAuthenticated: false,
          isLoading: false,
        };
      }
    } catch {
      this.state = {
        user: null,
        isAuthenticated: false,
        isLoading: false,
      };
    }
    this.notify();
  }

  public subscribe(listener: AuthListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  public getState(): AuthState {
    return { ...this.state };
  }

  public async signInGuest(name: string = 'Explorer'): Promise<UserProfile> {
    const guestUser: UserProfile = {
      id: `guest_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      email: `${name.toLowerCase().replace(/\s+/g, '')}@kipu.local`,
      name,
      createdAt: Date.now(),
    };

    localStorage.setItem(this.storageKey, JSON.stringify(guestUser));
    this.state = {
      user: guestUser,
      isAuthenticated: true,
      isLoading: false,
    };
    this.notify();

    // Sync to Neon if configured
    this.syncUserToNeon(guestUser).catch(err => {
      console.warn('[AuthService] Neon sync notice:', err);
    });

    return guestUser;
  }

  public async signInWithEmail(email: string, name?: string): Promise<UserProfile> {
    const user: UserProfile = {
      id: `user_${Math.random().toString(36).substring(2, 9)}`,
      email,
      name: name || email.split('@')[0],
      createdAt: Date.now(),
    };

    localStorage.setItem(this.storageKey, JSON.stringify(user));
    this.state = {
      user,
      isAuthenticated: true,
      isLoading: false,
    };
    this.notify();

    // Sync to Neon if configured
    this.syncUserToNeon(user).catch(err => {
      console.warn('[AuthService] Neon sync notice:', err);
    });

    return user;
  }

  private async syncUserToNeon(user: UserProfile): Promise<void> {
    const neonClient = (await import('./NeonClient')).NeonClient.getInstance();
    if (neonClient.isConfigured()) {
      await neonClient.query(
        `INSERT INTO users (id, email, name, avatar_url)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (email)
         DO UPDATE SET name = EXCLUDED.name, updated_at = NOW();`,
        [user.id, user.email, user.name || null, user.avatarUrl || null]
      );
    }
  }

  public async signOut(): Promise<void> {
    localStorage.removeItem(this.storageKey);
    this.state = {
      user: null,
      isAuthenticated: false,
      isLoading: false,
    };
    this.notify();
  }
}
