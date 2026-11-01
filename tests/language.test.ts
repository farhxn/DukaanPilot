import assert from "node:assert/strict";
import { test } from "node:test";
import { languageFixtures } from "./fixtures/language.ts";
import { groundedAmounts, validateExtraction } from "../src/server/ai/contract.ts";
test("60 authored language goldens cover three languages and require clarification for ambiguous/unsupported inputs", () => {
  assert.equal(languageFixtures.length, 60);
  for (const language of ["english", "roman-urdu", "urdu"]) assert.equal(languageFixtures.filter(f => f.expected.language === language).length, 20);
  for (const fixture of languageFixtures) {
    assert.doesNotThrow(() => validateExtraction(fixture.expected), fixture.id);
    assert.doesNotThrow(() => groundedAmounts(fixture.expected, fixture.text), fixture.id);
    if (fixture.ambiguous) { assert.ok(fixture.expected.missingFields.length > 0, fixture.id); assert.ok(fixture.expected.clarification, fixture.id); }
  }
  // This checks authored expectations, not live model accuracy. Provider/model
  // evaluation remains pending until the account/credit/data review is supplied.
});
