import assert from "node:assert/strict";
import test from "node:test";
import { mobileGateway } from "../neem-pressure-pulse/src/lib/ai/mobile-gateway.server";

test("Lovable bridge authenticates, limits models and preserves streaming without exposing its provider key", async () => {
  const oldSecret = process.env.NEEM_AI_BRIDGE_SECRET,
    oldKey = process.env.LOVABLE_API_KEY,
    originalFetch = globalThis.fetch;
  const secret = "test-bridge-secret-with-more-than-32-characters";
  process.env.NEEM_AI_BRIDGE_SECRET = secret;
  process.env.LOVABLE_API_KEY = "test-provider-key";
  let calls = 0;
  globalThis.fetch = async (input, init) => {
    calls++;
    assert.equal(String(input), "https://ai.gateway.lovable.dev/v1/responses");
    assert.equal(
      new Headers(init?.headers).get("Authorization"),
      "Bearer test-provider-key",
    );
    const body = JSON.parse(String(init?.body));
    assert.equal(body.store, false);
    assert.equal(body.max_output_tokens, 2400);
    return new Response('data: {"text":"test"}\n\n', {
      headers: { "Content-Type": "text/event-stream" },
    });
  };
  const request = (body: object, token = secret) =>
    new Request("https://neem.test/api/neem-gateway/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  try {
    assert.equal(
      (
        await mobileGateway(
          request({ model: "openai/gpt-6-sol" }, "wrong"),
          "responses",
        )
      ).status,
      401,
    );
    assert.equal(
      (await mobileGateway(request({ model: "unapproved" }), "responses"))
        .status,
      400,
    );
    assert.equal(calls, 0);
    const response = await mobileGateway(
      request({
        model: "openai/gpt-6-sol",
        input: "Hello",
        store: true,
        max_output_tokens: 99999,
      }),
      "responses",
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "text/event-stream");
    assert.equal(response.headers.get("authorization"), null);
    assert.equal(await response.text(), 'data: {"text":"test"}\n\n');
    assert.equal(calls, 1);
    assert.equal(
      (
        await mobileGateway(
          request({
            model: "google/gemini-embedding-2",
            input: Array(33).fill("test"),
          }),
          "embeddings",
        )
      ).status,
      400,
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (oldSecret === undefined) delete process.env.NEEM_AI_BRIDGE_SECRET;
    else process.env.NEEM_AI_BRIDGE_SECRET = oldSecret;
    if (oldKey === undefined) delete process.env.LOVABLE_API_KEY;
    else process.env.LOVABLE_API_KEY = oldKey;
  }
});
