import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import test from "node:test";

const root = resolve(process.cwd());
const foundationCssPath = join(root, "components/v2/v2-foundation.module.css");
const foundationComponentPath = join(root, "components/v2/v2-foundation.tsx");
const globalsPath = join(root, "app/globals.css");

test("V2 tokens are opt-in and do not redefine production root tokens", () => {
  const css = readFileSync(foundationCssPath, "utf8");

  assert.match(css, /^\.root\s*\{/m);
  assert.doesNotMatch(css, /(^|[\s,{]):root\b/m);
  assert.match(css, /--v2-color-bg-canvas:/);
  assert.match(css, /--v2-font-size-body:/);
  assert.match(css, /--v2-space-4:/);
  assert.match(css, /--v2-radius-control:/);
  assert.match(css, /--v2-shadow-surface:/);
  assert.match(css, /--v2-focus-ring:/);
  assert.match(css, /--v2-motion-duration-base:/);
  assert.match(css, /--v2-control-min-size:\s*2\.75rem/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /--v2-color-action-primary:\s*var\(--v2-palette-blue-600\)/);
  assert.match(css, /--v2-palette-blue-600:\s*#2563eb/);
});

test("production token baseline remains unchanged", () => {
  const css = readFileSync(globalsPath, "utf8");

  const expectedBaseline = [
    "--color-background: #f6f8fa;",
    "--color-surface: #ffffff;",
    "--color-surface-dark: #111b20;",
    "--color-text-primary: #111b20;",
    "--color-brand: #9fd323;",
    "--spacing-4: 16px;",
    "--radius-md: 12px;",
    "--motion-base: 220ms;",
  ];

  for (const token of expectedBaseline) {
    assert.ok(css.includes(token), `missing production baseline token: ${token}`);
  }

  assert.doesNotMatch(css, /--v2-/);
  assert.doesNotMatch(css, /securium-v2/);
});

test("core V2 foreground and background pairs meet WCAG AA contrast", () => {
  const pairs = [
    ["#0f172a", "#f8fafc", "primary text on canvas"],
    ["#475569", "#ffffff", "secondary text on surface"],
    ["#64748b", "#ffffff", "muted text on surface"],
    ["#ffffff", "#2563eb", "primary action text"],
    ["#1d4ed8", "#eff6ff", "strong blue text on soft blue"],
    ["#047857", "#ecfdf5", "published status text"],
  ] as const;

  for (const [foreground, background, label] of pairs) {
    assert.ok(
      contrastRatio(foreground, background) >= 4.5,
      `${label} must have at least 4.5:1 contrast`,
    );
  }
});

test("V2 activation is limited to approved phase surfaces", () => {
  const component = readFileSync(foundationComponentPath, "utf8");
  assert.match(component, /data-v2-foundation/);
  assert.match(component, /styles\.root/);

  const consumers = [...walk(join(root, "app")), ...walk(join(root, "components"))]
    .filter((path) => /\.(?:ts|tsx)$/.test(path))
    .filter((path) => !path.startsWith(join(root, "components/v2")))
    .filter((path) => {
      const source = readFileSync(path, "utf8");
      return /V2Foundation|data-v2-foundation|securium-v2/.test(source);
    })
    .map((path) => relative(root, path).replaceAll("\\", "/"));

  assert.deepEqual(consumers, [
    "app/page.tsx",
    "components/learner-app-shell.tsx",
  ]);
});

function* walk(directory: string): Generator<string> {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      yield* walk(path);
    } else {
      yield path;
    }
  }
}

function contrastRatio(foreground: string, background: string) {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

function luminance(hex: string) {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)!
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4,
    );
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}
