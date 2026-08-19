import assert from "node:assert/strict";
import { test } from "node:test";

import { withRetries } from "../src/utils/index.js";

test("retries then succeeds", async () => {
  let calls = 0;
  const result = await withRetries(
    async () => {
      calls += 1;
      if (calls === 1) throw new Error("transient");
      return "ok";
    },
    {
      maxAttempts: 2,
      backoffSeconds: 0,
      shouldRetry: (error) => error instanceof Error && error.message === "transient",
    },
  );
  assert.equal(result, "ok");
  assert.equal(calls, 2);
});

test("does not retry non-retryable errors", async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      withRetries(
        async () => {
          calls += 1;
          throw new TypeError("nope");
        },
        {
          maxAttempts: 3,
          backoffSeconds: 0,
          shouldRetry: (error) => error instanceof Error && error.message === "transient",
        },
      ),
    TypeError,
  );
  assert.equal(calls, 1);
});
