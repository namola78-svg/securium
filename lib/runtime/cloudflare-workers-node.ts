/**
 * Native Next.js/Vercel replacement for the Cloudflare Workers env binding.
 *
 * The Cloudflare/Vinext build keeps resolving `cloudflare:workers` normally.
 * next.config.ts aliases that specifier to this module only for the Node
 * runtime, where configuration is supplied through server environment
 * variables. D1 is intentionally unavailable on this path.
 */
export const env = new Proxy<Record<string, unknown>>(
  {},
  {
    get(_target, property) {
      if (typeof property !== "string") return undefined;
      return process.env[property];
    },
  },
);
