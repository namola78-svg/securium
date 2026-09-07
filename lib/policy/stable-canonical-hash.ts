type CanonicalJson = null | boolean | number | string | readonly CanonicalJson[] | { readonly [key: string]: CanonicalJson };

function normalize(value: unknown): CanonicalJson {
  if (typeof value === "string") return value.normalize("NFC").replace(/\r\n?/g, "\n");
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>).sort().map((key) => [key, normalize((value as Record<string, unknown>)[key])]),
    ) as { readonly [key: string]: CanonicalJson };
  }
  if (value === undefined) return null;
  return value as CanonicalJson;
}

export function stableCanonicalJson(value: unknown): string {
  return JSON.stringify(normalize(value));
}

export async function sha256Canonical(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(stableCanonicalJson(value)));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
