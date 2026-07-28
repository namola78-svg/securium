import { AppError } from "./errors.ts";
import { validatePostgreSqlEnvironment } from "../db/postgres/connection-config.ts";
import { resolveDatabaseProviderName } from "../db/provider/provider-factory.ts";

export type RuntimeEnvironment = {
  AUTH_PROVIDER?: string;
  APP_ENV?: string;
  DEV_AUTH_EMAIL?: string;
  AUDIT_IP_HASH_SALT?: string;
  AI_PROVIDER?: string;
  OPENAI_API_KEY?: string;
  DB_PROVIDER?: string;
  DATABASE_URL?: string;
  DIRECT_URL?: string;
  POSTGRES_MAX_CONNECTIONS?: string;
  POSTGRES_IDLE_TIMEOUT_SECONDS?: string;
  POSTGRES_CONNECT_TIMEOUT_SECONDS?: string;
  POSTGRES_QUERY_TIMEOUT_MS?: string;
  POSTGRES_SSL_MODE?: string;
  STORAGE_PROVIDER?: string;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_PUBLIC_BUCKET?: string;
  SUPABASE_PRIVATE_AUDIO_BUCKET?: string;
  SUPABASE_PRIVATE_LECTURE_BUCKET?: string;
  SUPABASE_COURSE_ASSETS_BUCKET?: string;
  SUPABASE_ADMIN_IMPORTS_BUCKET?: string;
};

const SECRET_NAME =
  /SECRET|TOKEN|PASSWORD|PASSWD|API_KEY|PRIVATE_KEY|SERVICE_ROLE/i;

export function validateRuntimeEnvironment(
  environment: RuntimeEnvironment,
  production: boolean,
) {
  for (const [name, value] of Object.entries(
    environment as Record<string, unknown>,
  )) {
    if (name.startsWith("NEXT_PUBLIC_") && SECRET_NAME.test(name) && value) {
      throw configurationError(
        `클라이언트 공개 환경변수 ${name}에 비밀값을 둘 수 없습니다.`,
      );
    }
  }

  const databaseProvider = resolveDatabaseProviderName(environment);
  validatePostgreSqlEnvironment(environment);
  validateAuthEnvironment(environment, production);
  if (
    databaseProvider === "supabase" &&
    !environment.DATABASE_URL?.trim()
  ) {
    throw configurationError(
      "Supabase DB_PROVIDER requires DATABASE_URL.",
    );
  }
  validateStorageEnvironment(environment, production);

  if (!production) return;
  if (environment.DEV_AUTH_EMAIL) {
    throw configurationError(
      "Production에서는 DEV_AUTH_EMAIL을 설정할 수 없습니다.",
    );
  }
  const salt = environment.AUDIT_IP_HASH_SALT?.trim();
  if (!salt || salt.length < 32 || isWeakSecret(salt)) {
    throw configurationError(
      "Production AUDIT_IP_HASH_SALT는 32자 이상의 고유 Secret이어야 합니다.",
    );
  }
  if (
    environment.AI_PROVIDER?.toLowerCase() === "openai" &&
    (!environment.OPENAI_API_KEY ||
      environment.OPENAI_API_KEY.length < 20 ||
      isWeakSecret(environment.OPENAI_API_KEY))
  ) {
    throw configurationError(
      "OpenAI Provider에는 안전한 서버 전용 API Key가 필요합니다.",
    );
  }
}

function validateAuthEnvironment(
  environment: RuntimeEnvironment,
  production: boolean,
) {
  const provider = environment.AUTH_PROVIDER?.trim().toLowerCase() || "sites";
  if (!["sites", "supabase"].includes(provider)) {
    throw configurationError("AUTH_PROVIDER must be sites or supabase.");
  }
  if (provider !== "supabase") return;

  const supabaseUrl =
    environment.SUPABASE_URL?.trim() ||
    environment.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey =
    environment.SUPABASE_ANON_KEY?.trim() ||
    environment.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  let url: URL;
  try {
    url = new URL(supabaseUrl ?? "");
  } catch {
    throw configurationError(
      "Supabase Auth requires a valid HTTPS SUPABASE_URL.",
    );
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw configurationError(
      "Supabase Auth requires a credential-free HTTPS SUPABASE_URL.",
    );
  }

  if (!anonKey || anonKey.length < 24 || (production && isWeakSecret(anonKey))) {
    throw configurationError(
      "Supabase Auth requires a valid SUPABASE_ANON_KEY.",
    );
  }
}

function validateStorageEnvironment(
  environment: RuntimeEnvironment,
  production: boolean,
) {
  const configuredProvider = environment.STORAGE_PROVIDER?.trim();
  // Storage is not active in the existing application. An omitted provider
  // therefore means "feature not configured", not an implicit production
  // local filesystem.
  if (!configuredProvider) return;
  const provider = configuredProvider.toLowerCase();
  if (!["local", "supabase"].includes(provider)) {
    throw configurationError(
      "STORAGE_PROVIDER must be either local or supabase.",
    );
  }
  if (production && provider === "local") {
    throw configurationError(
      "Production must use a durable storage provider.",
    );
  }
  if (provider !== "supabase") return;
  let url: URL;
  try {
    url = new URL(environment.SUPABASE_URL ?? "");
  } catch {
    throw configurationError(
      "SUPABASE_URL must be configured as a valid HTTPS URL.",
    );
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw configurationError(
      "SUPABASE_URL must be a credential-free HTTPS URL.",
    );
  }
  const serviceRoleKey = environment.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (
    !serviceRoleKey ||
    serviceRoleKey.length < 24 ||
    isWeakSecret(serviceRoleKey)
  ) {
    throw configurationError(
      "A strong server-only SUPABASE_SERVICE_ROLE_KEY is required.",
    );
  }
}

export function isProductionEnvironment(environment: RuntimeEnvironment) {
  return environment.APP_ENV?.trim().toLowerCase() === "production";
}

function isWeakSecret(value: string) {
  return /^(secret|password|changeme|change-me|default|test|development|12345678)$/i.test(
    value.trim(),
  );
}

function configurationError(message: string) {
  return new AppError(message, 500, "SECURITY_CONFIGURATION_INVALID");
}
