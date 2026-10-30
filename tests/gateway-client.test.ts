import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { GatewayClient } from "../src/gateway/gateway-client.js";
import { ActiveGraphicsStore } from "../src/store/active-graphics-store.js";
import { GraphicsEventBroker } from "../src/events.js";
import { formatSpeakerStrap, resolveSpeakerFromRundown } from "../src/gateway/speaker-resolver.js";

describe("GatewayClient & Speaker Resolution", () => {
  it("formats speaker strap with name and title when name is present", () => {
    const strap = formatSpeakerStrap({
      role: "Liturgi",
      name: "Pastori Matti",
      title: "Kirkkoherra",
    });
    assert.equal(strap.speaker, "Pastori Matti");
    assert.equal(strap.title, "Kirkkoherra");
    assert.equal(strap.role, "Liturgi");
    assert.equal(strap.hasName, true);
  });

  it("displays ONLY role when name is absent", () => {
    const strap = formatSpeakerStrap({
      role: "Saarnaaja",
      name: undefined, // name not present
    });
    // Rule: If names are not present, only role can be displayed!
    assert.equal(strap.speaker, "Saarnaaja");
    assert.equal(strap.hasName, false);
    assert.equal(strap.title, "Riihimäen Keskuskirkko");
  });

  it("resolves speaker and role from rundown variables", () => {
    // 1. With defined preacher name in variables
    const strapWithPreacher = resolveSpeakerFromRundown(
      { id: "saarna", title: "Saarna", section: "Sana" },
      { preacher: "Pastori Anna", preacher_title: "Saarnaaja" }
    );
    assert.ok(strapWithPreacher);
    assert.equal(strapWithPreacher.speaker, "Pastori Anna");
    assert.equal(strapWithPreacher.title, "Saarnaaja");
    assert.equal(strapWithPreacher.hasName, true);

    // 2. Without preacher name in variables: only role displayed!
    const strapRoleOnly = resolveSpeakerFromRundown(
      { id: "saarna", title: "Saarna", section: "Sana" },
      {} // No preacher name defined
    );
    assert.ok(strapRoleOnly);
    assert.equal(strapRoleOnly.speaker, "Saarnaaja");
    assert.equal(strapRoleOnly.hasName, false);
  });

  it("never infers name based on transcription alone", async () => {
    const broker = new GraphicsEventBroker();
    const activeStore = new ActiveGraphicsStore(broker);

    // Simulated SSE payload with transcript and rundown
    const ssePayload = [
      // Transcript with a speaker name that MUST BE IGNORED
      `event: transcript\ndata: {"session_id":"s1","events":[{"seq":1,"speaker":"Inferred From Audio","text":"Aamen"}]}\n\n`,
      // Rundown event with role only (no name)
      `event: rundown\ndata: {"currentItem":{"id":"alkusiunaus","title":"Alkusiunaus","section":"Johdanto"},"variables":{}}\n\n`,
    ].join("");

    const mockFetch: typeof fetch = async () => {
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(ssePayload));
            controller.close();
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        }
      );
    };

    const client = new GatewayClient({
      gatewayUrl: "http://localhost:3100",
      activeStore,
      eventBroker: broker,
      fetchFn: mockFetch,
    });

    client.start();
    await new Promise((r) => setTimeout(r, 100));
    client.stop();

    const bindings = activeStore.getBindings();
    // Verify name was NEVER taken from audio transcription!
    assert.notEqual(bindings.speaker, "Inferred From Audio");
    // Verify role was taken from rundown:
    assert.equal(bindings.speaker, "Liturgi");
    assert.equal(bindings.role, "Liturgi");
  });
});
