import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_NAMING, normalizeNaming } from "../settings.ts";

test("the naming title length defaults to 32 characters", () => {
  assert.equal(DEFAULT_NAMING.maxChars, 32);
  assert.equal(normalizeNaming(undefined).maxChars, 32);
});

test("a configured title length is loaded and normalized to a positive integer", () => {
  assert.equal(normalizeNaming({ maxChars: 48 }).maxChars, 48);
  assert.equal(normalizeNaming({ maxChars: 18.9 }).maxChars, 18);
  assert.equal(normalizeNaming({ maxChars: 0 }).maxChars, 1);
});
