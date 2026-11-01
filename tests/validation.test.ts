import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizePhone, contactInput, businessInput, listInput } from "../src/server/domain/validation.ts";
import { DomainError } from "../src/server/errors.ts";

test("Pakistani national and explicit international phones normalize consistently", () => {
  assert.equal(normalizePhone("0300 1234567"), "+923001234567");
  assert.equal(normalizePhone("0092 300 1234567"), "+923001234567");
  assert.equal(normalizePhone("923001234567"), "+923001234567");
  assert.equal(normalizePhone(null), null);
  for (const invalid of ["3001234567", "123", "+92-not-a-number", "03001234567 ext 1"]) assert.throws(() => normalizePhone(invalid), DomainError);
});

test("caller-supplied tenant/role, invalid names and currencies are rejected", () => {
  assert.throws(() => contactInput({ name: "Ali", tenantId: "forged" }), DomainError);
  assert.throws(() => contactInput({ name: "Ali", role: "OWNER" }), DomainError);
  assert.throws(() => contactInput({ name: "\n" }), DomainError);
  assert.throws(() => businessInput({ name: "Shop", businessType: "Retail", city: "Karachi", currency: "USD" }), DomainError);
  assert.equal(contactInput({ name: "  علی  " }).name, "علی");
});

test("versions, pagination and search are bounded and strict", () => {
  assert.throws(() => contactInput({ name: "Ali" }, true), DomainError);
  assert.throws(() => contactInput({ version: 1 }, true), DomainError);
  assert.throws(() => listInput(new URLSearchParams("limit=101")), DomainError);
  assert.throws(() => listInput(new URLSearchParams("tenantId=forged")), DomainError);
  assert.throws(() => listInput(new URLSearchParams("archived=yes")), DomainError);
  assert.equal(listInput(new URLSearchParams("q=Ali&limit=10")).limit, 10);
});
