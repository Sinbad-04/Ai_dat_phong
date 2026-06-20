import test from "node:test";
import assert from "node:assert/strict";
import { checkRateLimit } from "../lib/rate-limit";

test("rate limiter rejects requests over the configured limit and resets", () => {
  const request = new Request("http://localhost/test", { headers: { "x-forwarded-for": "203.0.113.10" } });
  const namespace = `test-${Date.now()}`;
  assert.equal(checkRateLimit(request, { namespace, limit: 2, windowMs: 1000, now: 100 }).allowed, true);
  assert.equal(checkRateLimit(request, { namespace, limit: 2, windowMs: 1000, now: 101 }).allowed, true);
  assert.equal(checkRateLimit(request, { namespace, limit: 2, windowMs: 1000, now: 102 }).allowed, false);
  assert.equal(checkRateLimit(request, { namespace, limit: 2, windowMs: 1000, now: 1200 }).allowed, true);
});

