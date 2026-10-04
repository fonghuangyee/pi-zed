import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_SETTINGS, normalizeSettings } from "../settings.ts";

test("the extension defaults to a 32-character generated-title limit", () => {
  assert.equal(DEFAULT_SETTINGS.naming.maxChars, 32);
  assert.equal(normalizeSettings(undefined).naming.maxChars, 32);
});

test("the configured title-length setting is loaded", () => {
  assert.equal(normalizeSettings({ naming: { maxChars: 48 } }).naming.maxChars, 48);
});
