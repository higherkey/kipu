import { neon } from '@neondatabase/serverless';

export class NeonClient {
  private static instance: NeonClient;
  private sqlClient: ReturnType<typeof neon> | null = null;
  private databaseUrl: string | null = null;

  private constructor() {
    this.databaseUrl = import.meta.env.VITE_NEON_DATABASE_URL || null;
    if (this.databaseUrl) {
      try {
        this.sqlClient = neon(this.databaseUrl);
      } catch (err) {
        console.warn('[NeonClient] Failed to initialize Neon client from URL:', err);
      }
    }
  }

  public static getInstance(): NeonClient {
    if (!NeonClient.instance) {
      NeonClient.instance = new NeonClient();
    }
    return NeonClient.instance;
  }

  public isConfigured(): boolean {
    return Boolean(this.sqlClient);
  }

  public async query<T = any>(queryString: string, params: any[] = []): Promise<T[]> {
    if (!this.sqlClient) {
      console.warn('[NeonClient] Database not configured. Returning empty results.');
      return [];
    }
    try {
      const result = await (this.sqlClient as any)(queryString, params);
      return result as T[];
    } catch (err) {
      console.error('[NeonClient] Query error:', err);
      throw err;
    }
  }
}
