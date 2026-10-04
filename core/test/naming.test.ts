import assert from "node:assert/strict";
import test from "node:test";

import {
  compactTitle,
  describeRenameFailure,
  formatTitle,
  generateTitle,
  getFirstUserPrompt,
  normalizeThinkingLevel,
  parseGeneratedTitle,
  sanitizeTitle,
} from "../naming.ts";

const NAMING_CONFIG = {
  enabled: true,
  model: "",
  thinking: "low",
  maxChars: 32,
  caseStyle: "title" as const,
};

function contextWithProviderStream(options: {
  streamSimple?: unknown;
  auth: { ok: true } | { ok: false; error: string };
  onCall?: (model: unknown, request: unknown, opts: unknown) => void;
}) {
  return {
    model: { provider: "claude-bridge", id: "claude-opus-5", api: "claude-bridge" },
    modelRegistry: {
      find: () => undefined,
      getApiKeyAndHeaders: async () => options.auth,
      getRegisteredProviderConfig: () =>
        options.streamSimple ? { streamSimple: options.streamSimple } : undefined,
    },
  } as never;
}

function streamReturning(text: string, onCall?: (...args: unknown[]) => void) {
  return (...args: unknown[]) => {
    onCall?.(...args);
    return { result: async () => ({ content: [{ type: "text", text }] }) };
  };
}

test("a TITLE line is unwrapped", () => {
  assert.equal(parseGeneratedTitle("TITLE: Fix OAuth callback").title, "Fix OAuth callback");
});

test("a bare single line is treated as the title", () => {
  assert.equal(parseGeneratedTitle("OAuthコールバック修正").title, "OAuthコールバック修正");
});

test("sanitizeTitle drops newlines, control characters, and surrounding quotes", () => {
  assert.equal(sanitizeTitle('  "ログイン\n処理の\t修正"  '), "ログイン 処理の 修正");
});

test("title formatting supports title case and lowercase", () => {
  assert.equal(formatTitle("fix OAuth callback", "title"), "Fix OAuth Callback");
  assert.equal(formatTitle("Fix OAuth Callback", "lowercase"), "fix oauth callback");
});

test("a title within the limit is kept as is", () => {
  assert.equal(compactTitle("OAuth認証の修正"), "OAuth認証の修正");
});

test("a title over the limit is shortened at a whole-word boundary", () => {
  assert.equal(
    compactTitle("Investigate Trade Credit app insights", 32),
    "Investigate Trade Credit app",
  );
  assert.equal(compactTitle("あ".repeat(40)), undefined);
  assert.equal(compactTitle("OAuth 🔐 callback details", 12), "OAuth 🔐");
});

test("a title that sanitizes to nothing is undefined", () => {
  assert.equal(compactTitle('  "" \n '), undefined);
});

test("a title limit is applied to Unicode code points", () => {
  assert.equal(compactTitle("Fix 🔐 OAuth callback", 7), "Fix 🔐");
});

test("a single overlong word is not cut into a fragment", () => {
  assert.equal(compactTitle("InvestigateTradeCreditApp", 12), undefined);
});

test("leading expanded skills are excluded from the first prompt", () => {
  const prompt = `<skill name="example">
Follow the skill instructions.
</skill>

Deploy blue widgets`;
  const entries = [{ type: "message", message: { role: "user", content: prompt } }] as never;

  assert.equal(getFirstUserPrompt(entries), "Deploy blue widgets");
  assert.equal(getFirstUserPrompt([], prompt), "Deploy blue widgets");
});

test("generated titles are instructed to honor the configured character limit", async () => {
  let systemPrompt = "";
  const ctx = contextWithProviderStream({
    auth: { ok: true },
    streamSimple: streamReturning("TITLE: Fix OAuth", (_model, request) => {
      systemPrompt = (request as { systemPrompt: string }).systemPrompt;
    }),
  });

  const result = await generateTitle(
    "Fix the OAuth callback",
    "user_message",
    ctx,
    { ...NAMING_CONFIG, maxChars: 24 },
  );

  assert.deepEqual(result, { ok: true, title: "Fix OAuth" });
  assert.match(systemPrompt, /at most 24 Unicode code points/);
  assert.match(systemPrompt, /complete phrase instead of cutting words off/);
  assert.match(systemPrompt, /Never end with a dangling preposition/);
  assert.match(systemPrompt, /maximum, not a target/);
});

test("an overlong generated title is shortened without a partial final word", async () => {
  const ctx = contextWithProviderStream({
    auth: { ok: true },
    streamSimple: streamReturning("TITLE: Investigate Trade Credit app insights"),
  });

  const result = await generateTitle("Investigate Trade Credit", "user_message", ctx, NAMING_CONFIG);

  assert.deepEqual(result, { ok: true, title: "Investigate Trade Credit app" });
});

test("an extension-registered provider streams the title itself", async () => {
  let called = 0;
  const ctx = contextWithProviderStream({
    auth: { ok: true },
    streamSimple: streamReturning("TITLE: ブリッジ経由の命名", () => {
      called += 1;
    }),
  });

  const result = await generateTitle("タイトルを付けて", "user_message", ctx, NAMING_CONFIG);

  assert.deepEqual(result, { ok: true, title: "ブリッジ経由の命名" });
  assert.equal(called, 1);
});

test("a provider stream runs even when no request auth resolves", async () => {
  const ctx = contextWithProviderStream({
    auth: { ok: false, error: "no api key" },
    streamSimple: streamReturning("TITLE: 認証なしでも命名"),
  });

  const result = await generateTitle("タイトルを付けて", "user_message", ctx, NAMING_CONFIG);

  assert.deepEqual(result, { ok: true, title: "認証なしでも命名" });
});

test("without a provider stream, unresolved auth stops the request", async () => {
  const ctx = contextWithProviderStream({ auth: { ok: false, error: "no api key" } });

  const result = await generateTitle("タイトルを付けて", "user_message", ctx, NAMING_CONFIG);

  assert.deepEqual(result, { ok: false, reason: "missing_auth", detail: "no api key" });
});

test("a failed request keeps the underlying error message", async () => {
  const ctx = contextWithProviderStream({
    auth: { ok: true },
    streamSimple: () => ({
      result: async () => {
        throw new Error("No API provider registered for api: claude-bridge");
      },
    }),
  });

  const result = await generateTitle("タイトルを付けて", "user_message", ctx, NAMING_CONFIG);

  assert.deepEqual(result, {
    ok: false,
    reason: "request_failed",
    detail: "No API provider registered for api: claude-bridge",
  });
  assert.equal(
    describeRenameFailure("request_failed", "No API provider registered for api: claude-bridge"),
    "Title rename request failed. (No API provider registered for api: claude-bridge)",
  );
});

test("only known thinking levels are passed through", () => {
  assert.equal(normalizeThinkingLevel("low"), "low");
  assert.equal(normalizeThinkingLevel("LOW"), "low");
  assert.equal(normalizeThinkingLevel("off"), undefined);
  assert.equal(normalizeThinkingLevel("nonsense"), undefined);
});
