import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { GatewayClient } from "../src/gateway/gateway-client.js";
import { ActiveGraphicsStore } from "../src/store/active-graphics-store.js";
import { GraphicsEventBroker } from "../src/events.js";

describe("GatewayClient SSE ingestion", () => {
  it("translates gateway actions and transcript speaker events into graphics commands", async () => {
    const broker = new GraphicsEventBroker();
    const activeStore = new ActiveGraphicsStore(broker);

    // Simulated SSE stream
    const ssePayload = [
      `event: action\ndata: {"actor":"pirundown","action":"graphic.show","params":{"templateId":"lower-third-speaker","instanceId":"lt-test","bindings":{"speaker":"Piispa","title":"Helsinki"}}}\n\n`,
      `event: transcript\ndata: {"session_id":"s1","events":[{"seq":1,"speaker":"Kanttori Esimerkki","text":"Veisatkaamme virsi"}]}\n\n`,
    ].join("");

    const mockFetch: typeof fetch = async () => {
      return new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(ssePayload));
          controller.close();
        },
      }), {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      });
    };

    const client = new GatewayClient({
      gatewayUrl: "http://localhost:3100",
      activeStore,
      eventBroker: broker,
      fetchFn: mockFetch,
    });

    client.start();

    // Allow async stream processing
    await new Promise((r) => setTimeout(r, 100));
    client.stop();

    const active = activeStore.getActive();
    assert.equal(active.length, 1);
    assert.equal(active[0]?.instanceId, "lt-test");
    assert.equal(active[0]?.templateId, "lower-third-speaker");

    // Check transcript speaker binding update
    const bindings = activeStore.getBindings();
    assert.equal(bindings.speaker, "Kanttori Esimerkki");
  });
});
