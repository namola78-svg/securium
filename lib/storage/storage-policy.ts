import { AppError } from "../errors.ts";
import {
  validateUpload,
  type UploadCandidate,
  type UploadKind,
  type UploadVisibility,
} from "../services/file-upload-security.ts";

export const STORAGE_BUCKETS = {
  "public-thumbnails": {
    visibility: "PUBLIC",
    uploadKinds: ["IMAGE"],
  },
  "private-audio": {
    visibility: "PRIVATE",
    uploadKinds: ["AUDIO"],
  },
  "private-lectures": {
    visibility: "PRIVATE",
    uploadKinds: ["VIDEO"],
  },
  "course-assets": {
    visibility: "PRIVATE",
    uploadKinds: ["IMAGE", "DOCUMENT"],
  },
  "admin-imports": {
    visibility: "PRIVATE",
    uploadKinds: ["IMPORT"],
  },
} as const satisfies Record<
  string,
  { visibility: UploadVisibility; uploadKinds: readonly UploadKind[] }
>;

export type StorageBucket = keyof typeof STORAGE_BUCKETS;
export type StorageAction = "READ" | "WRITE" | "DELETE";

export type StorageActor = {
  userId: string;
  roles: readonly string[];
};

export type StorageAuthorizationContext = {
  actor: StorageActor | null;
  ownsPrivateObject?: (
    bucket: StorageBucket,
    storageKey: string,
    userId: string,
  ) => Promise<boolean>;
};

export interface StorageAuthorizationPolicy {
  assertAllowed(
    action: StorageAction,
    bucket: StorageBucket,
    storageKey: string,
    context: StorageAuthorizationContext,
  ): Promise<void>;
}

const STORAGE_MANAGERS = new Set([
  "CONTENT_EDITOR",
  "COURSE_MANAGER",
  "ADMIN",
  "SUPER_ADMIN",
]);

export class ServerStorageAuthorizationPolicy
  implements StorageAuthorizationPolicy
{
  async assertAllowed(
    action: StorageAction,
    bucket: StorageBucket,
    storageKey: string,
    context: StorageAuthorizationContext,
  ) {
    if (action === "READ" && STORAGE_BUCKETS[bucket].visibility === "PUBLIC") {
      return;
    }
    const actor = context.actor;
    if (!actor) throw forbidden();
    if (actor.roles.some((role) => STORAGE_MANAGERS.has(role))) return;
    if (
      action === "READ" &&
      context.ownsPrivateObject &&
      (await context.ownsPrivateObject(bucket, storageKey, actor.userId))
    ) {
      return;
    }
    throw forbidden();
  }
}

export function validateStorageUpload(
  bucket: StorageBucket,
  candidate: Omit<UploadCandidate, "kind" | "visibility">,
) {
  const policy = STORAGE_BUCKETS[bucket];
  let lastError: unknown;
  for (const kind of policy.uploadKinds) {
    try {
      return validateUpload({
        ...candidate,
        kind,
        visibility: policy.visibility,
      });
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new AppError("The upload is not allowed.", 422, "UPLOAD_TYPE_INVALID");
}

export function assertStorageKey(storageKey: string) {
  if (
    !storageKey ||
    storageKey.length > 500 ||
    storageKey.startsWith("/") ||
    storageKey.includes("\\") ||
    storageKey.split("/").some((part) => !part || part === "." || part === "..") ||
    /[\u0000-\u001f\u007f?#]/.test(storageKey)
  ) {
    throw new AppError(
      "The storage key is invalid.",
      422,
      "STORAGE_KEY_INVALID",
    );
  }
}

function forbidden() {
  return new AppError(
    "You do not have permission to access this object.",
    403,
    "STORAGE_ACCESS_FORBIDDEN",
  );
}
