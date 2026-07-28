interface Fetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

interface D1Result<T = Record<string, unknown>> {
  results: T[];
  success: boolean;
  meta: Record<string, unknown>;
  error?: string;
}

interface D1ExecResult {
  count: number;
  duration: number;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(columnName?: string): Promise<T | null>;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  raw<T = unknown[]>(options?: { columnNames?: boolean }): Promise<T[]>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = Record<string, unknown>>(
    statements: D1PreparedStatement[],
  ): Promise<D1Result<T>[]>;
  exec(query: string): Promise<D1ExecResult>;
  dump(): Promise<ArrayBuffer>;
}

declare module "cloudflare:workers" {
  export const env: {
    DB?: D1Database;
    APP_ENV?: string;
    DEV_AUTH_EMAIL?: string;
    AUDIT_IP_HASH_SALT?: string;
    AI_PROVIDER?: string;
    OPENAI_API_KEY?: string;
    OPENAI_MODEL?: string;
    AI_DAILY_LIMIT?: string;
    AI_TIMEOUT_MS?: string;
    AI_MAX_RETRIES?: string;
    AI_RETENTION_DAYS?: string;
    AUDIO_ALLOWED_HOSTS?: string;
    SECURITY_ALLOWED_AUDIO_ORIGINS?: string;
    SECURITY_ALLOWED_IMAGE_ORIGINS?: string;
    SECURITY_ALLOWED_FRAME_ORIGINS?: string;
    DATABASE_URL?: string;
    DIRECT_URL?: string;
    STORAGE_PROVIDER?: string;
    SUPABASE_URL?: string;
    SUPABASE_SERVICE_ROLE_KEY?: string;
  };
}
