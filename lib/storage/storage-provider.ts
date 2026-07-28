import { AppError } from "../errors.ts";
import {
  STORAGE_BUCKETS,
  ServerStorageAuthorizationPolicy,
  assertStorageKey,
  validateStorageUpload,
  type StorageAuthorizationContext,
  type StorageAuthorizationPolicy,
  type StorageBucket,
} from "./storage-policy.ts";

export type StorageUploadInput = {
  bucket: StorageBucket;
  originalName: string;
  mimeType: string;
  bytes: Uint8Array;
};

export type StoredObject = {
  provider: "local" | "supabase";
  bucket: StorageBucket;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
};

export type StorageReadUrl = {
  url: string;
  expiresAt: Date | null;
};

export interface StorageProvider {
  put(
    input: StorageUploadInput,
    authorization: StorageAuthorizationContext,
  ): Promise<StoredObject>;
  createReadUrl(
    bucket: StorageBucket,
    storageKey: string,
    authorization: StorageAuthorizationContext,
    expiresInSeconds?: number,
  ): Promise<StorageReadUrl>;
  delete(
    bucket: StorageBucket,
    storageKey: string,
    authorization: StorageAuthorizationContext,
  ): Promise<void>;
}

type StoredBytes = {
  bytes: Uint8Array;
  mimeType: string;
};

export class LocalStorageProvider implements StorageProvider {
  private readonly objects = new Map<string, StoredBytes>();
  private readonly authorizationPolicy: StorageAuthorizationPolicy;

  constructor(
    authorizationPolicy: StorageAuthorizationPolicy =
      new ServerStorageAuthorizationPolicy(),
  ) {
    this.authorizationPolicy = authorizationPolicy;
  }

  async put(
    input: StorageUploadInput,
    authorization: StorageAuthorizationContext,
  ) {
    const validated = validateStorageUpload(input.bucket, {
      originalName: input.originalName,
      mimeType: input.mimeType,
      sizeBytes: input.bytes.byteLength,
    });
    await this.authorizationPolicy.assertAllowed(
      "WRITE",
      input.bucket,
      validated.storageKey,
      authorization,
    );
    this.objects.set(objectId(input.bucket, validated.storageKey), {
      bytes: input.bytes.slice(),
      mimeType: validated.mimeType,
    });
    return {
      provider: "local" as const,
      bucket: input.bucket,
      storageKey: validated.storageKey,
      mimeType: validated.mimeType,
      sizeBytes: validated.sizeBytes,
    };
  }

  async createReadUrl(
    bucket: StorageBucket,
    storageKey: string,
    authorization: StorageAuthorizationContext,
  ) {
    assertStorageKey(storageKey);
    await this.authorizationPolicy.assertAllowed(
      "READ",
      bucket,
      storageKey,
      authorization,
    );
    if (!this.objects.has(objectId(bucket, storageKey))) {
      throw new AppError("Object not found.", 404, "STORAGE_OBJECT_NOT_FOUND");
    }
    return {
      // Development/test locator only. No route currently exposes local bytes.
      url: `local-storage://${bucket}/${encodeStorageKey(storageKey)}`,
      expiresAt: null,
    };
  }

  async delete(
    bucket: StorageBucket,
    storageKey: string,
    authorization: StorageAuthorizationContext,
  ) {
    assertStorageKey(storageKey);
    await this.authorizationPolicy.assertAllowed(
      "DELETE",
      bucket,
      storageKey,
      authorization,
    );
    this.objects.delete(objectId(bucket, storageKey));
  }
}

export type SupabaseStorageProviderOptions = {
  supabaseUrl: string;
  serviceRoleKey: string;
  bucketNames?: Partial<Record<StorageBucket, string>>;
  fetcher?: typeof fetch;
  authorizationPolicy?: StorageAuthorizationPolicy;
};

export class SupabaseStorageProvider implements StorageProvider {
  private readonly baseUrl: string;
  private readonly serviceRoleKey: string;
  private readonly fetcher: typeof fetch;
  private readonly authorizationPolicy: StorageAuthorizationPolicy;
  private readonly bucketNames: Record<StorageBucket, string>;

  constructor(options: SupabaseStorageProviderOptions) {
    const url = parseSupabaseUrl(options.supabaseUrl);
    if (
      !options.serviceRoleKey ||
      options.serviceRoleKey.length < 24 ||
      /^(secret|changeme|test|development)$/i.test(options.serviceRoleKey)
    ) {
      throw configurationError("A server-only Supabase service role key is required.");
    }
    this.baseUrl = url.toString().replace(/\/$/, "");
    this.serviceRoleKey = options.serviceRoleKey;
    this.fetcher = options.fetcher ?? fetch;
    this.authorizationPolicy =
      options.authorizationPolicy ?? new ServerStorageAuthorizationPolicy();
    this.bucketNames = resolveBucketNames(options.bucketNames);
  }

  async put(
    input: StorageUploadInput,
    authorization: StorageAuthorizationContext,
  ) {
    const validated = validateStorageUpload(input.bucket, {
      originalName: input.originalName,
      mimeType: input.mimeType,
      sizeBytes: input.bytes.byteLength,
    });
    await this.authorizationPolicy.assertAllowed(
      "WRITE",
      input.bucket,
      validated.storageKey,
      authorization,
    );
    await this.request(
      `/storage/v1/object/${this.remoteBucket(input.bucket)}/${encodeStorageKey(validated.storageKey)}`,
      {
        method: "POST",
        headers: {
          "content-type": validated.mimeType,
          "x-upsert": "false",
        },
        body: toRequestBody(input.bytes),
      },
    );
    return {
      provider: "supabase" as const,
      bucket: input.bucket,
      storageKey: validated.storageKey,
      mimeType: validated.mimeType,
      sizeBytes: validated.sizeBytes,
    };
  }

  async createReadUrl(
    bucket: StorageBucket,
    storageKey: string,
    authorization: StorageAuthorizationContext,
    expiresInSeconds = 900,
  ) {
    assertStorageKey(storageKey);
    await this.authorizationPolicy.assertAllowed(
      "READ",
      bucket,
      storageKey,
      authorization,
    );
    if (bucket === "public-thumbnails") {
      return {
        url: `${this.baseUrl}/storage/v1/object/public/${this.remoteBucket(bucket)}/${encodeStorageKey(storageKey)}`,
        expiresAt: null,
      };
    }
    if (
      !Number.isSafeInteger(expiresInSeconds) ||
      expiresInSeconds < 60 ||
      expiresInSeconds > 3600
    ) {
      throw new AppError(
        "Signed URL lifetime must be between 60 and 3600 seconds.",
        422,
        "STORAGE_EXPIRY_INVALID",
      );
    }
    const response = await this.request(
      `/storage/v1/object/sign/${this.remoteBucket(bucket)}/${encodeStorageKey(storageKey)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ expiresIn: expiresInSeconds }),
      },
    );
    const payload = (await response.json()) as { signedURL?: unknown };
    if (typeof payload.signedURL !== "string") {
      throw storageFailure();
    }
    const signedUrl = new URL(payload.signedURL, this.baseUrl);
    if (signedUrl.origin !== new URL(this.baseUrl).origin) throw storageFailure();
    return {
      url: signedUrl.toString(),
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
    };
  }

  async delete(
    bucket: StorageBucket,
    storageKey: string,
    authorization: StorageAuthorizationContext,
  ) {
    assertStorageKey(storageKey);
    await this.authorizationPolicy.assertAllowed(
      "DELETE",
      bucket,
      storageKey,
      authorization,
    );
    await this.request(
      `/storage/v1/object/${this.remoteBucket(bucket)}/${encodeStorageKey(storageKey)}`,
      { method: "DELETE" },
    );
  }

  private remoteBucket(bucket: StorageBucket) {
    return this.bucketNames[bucket];
  }

  private async request(path: string, init: RequestInit) {
    let response: Response;
    try {
      response = await this.fetcher(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          apikey: this.serviceRoleKey,
          authorization: `Bearer ${this.serviceRoleKey}`,
          ...init.headers,
        },
      });
    } catch {
      throw storageFailure();
    }
    if (!response.ok) throw storageFailure();
    return response;
  }
}

export type StorageProviderEnvironment = {
  APP_ENV?: string;
  STORAGE_PROVIDER?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_PUBLIC_BUCKET?: string;
  SUPABASE_PRIVATE_AUDIO_BUCKET?: string;
  SUPABASE_PRIVATE_LECTURE_BUCKET?: string;
  SUPABASE_COURSE_ASSETS_BUCKET?: string;
  SUPABASE_ADMIN_IMPORTS_BUCKET?: string;
};

export function createStorageProvider(
  environment: StorageProviderEnvironment,
  authorizationPolicy = new ServerStorageAuthorizationPolicy(),
): StorageProvider {
  const provider = environment.STORAGE_PROVIDER?.trim().toLowerCase() || "local";
  const production = environment.APP_ENV?.trim().toLowerCase() === "production";
  if (provider === "local") {
    if (production) {
      throw configurationError("Local storage cannot be used in production.");
    }
    return new LocalStorageProvider(authorizationPolicy);
  }
  if (provider !== "supabase") {
    throw configurationError("STORAGE_PROVIDER must be local or supabase.");
  }
  return new SupabaseStorageProvider({
    supabaseUrl: environment.SUPABASE_URL ?? "",
    serviceRoleKey: environment.SUPABASE_SERVICE_ROLE_KEY ?? "",
    bucketNames: {
      "public-thumbnails": environment.SUPABASE_PUBLIC_BUCKET ?? "",
      "private-audio": environment.SUPABASE_PRIVATE_AUDIO_BUCKET ?? "",
      "private-lectures":
        environment.SUPABASE_PRIVATE_LECTURE_BUCKET ?? "",
      "course-assets": environment.SUPABASE_COURSE_ASSETS_BUCKET ?? "",
      "admin-imports": environment.SUPABASE_ADMIN_IMPORTS_BUCKET ?? "",
    },
    authorizationPolicy,
  });
}

function objectId(bucket: StorageBucket, storageKey: string) {
  return `${bucket}:${storageKey}`;
}

function encodeStorageKey(storageKey: string) {
  return storageKey.split("/").map(encodeURIComponent).join("/");
}

function toRequestBody(bytes: Uint8Array) {
  const body = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(body).set(bytes);
  return body;
}

function parseSupabaseUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw configurationError("SUPABASE_URL must be a valid HTTPS URL.");
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw configurationError("SUPABASE_URL must be a credential-free HTTPS URL.");
  }
  return url;
}

function resolveBucketNames(
  input: Partial<Record<StorageBucket, string>> | undefined,
) {
  return Object.fromEntries(
    (Object.keys(STORAGE_BUCKETS) as StorageBucket[]).map((bucket) => {
      const configured = input?.[bucket]?.trim() || bucket;
      if (
        configured.length > 63 ||
        !/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/.test(configured)
      ) {
        throw configurationError(`The configured ${bucket} bucket is invalid.`);
      }
      return [bucket, configured];
    }),
  ) as Record<StorageBucket, string>;
}

function configurationError(message: string) {
  return new AppError(message, 500, "STORAGE_CONFIGURATION_INVALID");
}

function storageFailure() {
  return new AppError(
    "The storage operation could not be completed.",
    502,
    "STORAGE_REQUEST_FAILED",
  );
}
