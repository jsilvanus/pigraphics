import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { AtemAdapterClient } from "../src/switcher/piswitch-client.js";
import { TemplateStore } from "../src/store/template-store.js";
import { ActiveGraphicsStore } from "../src/store/active-graphics-store.js";
import { GraphicsEventBroker } from "../src/events.js";

describe("PiGraphics API Integration", () => {
  it("serves health, status, templates, and handles active graphics lifecycle", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "pigraphics-api-"));
    try {
      const config = loadConfig({
        PIGRAPHICS_PORT: "3107",
        PIGRAPHICS_DATA_DIR: tempDir,
      });

      const eventBroker = new GraphicsEventBroker();
      const templateStore = new TemplateStore(config.templatesDir);
      const activeStore = new ActiveGraphicsStore(eventBroker);

      // Mock fetch for piswitch to test atem push without physical ATEM
      const mockFetch: typeof fetch = async (url, opts) => {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      };

      const atemClient = new AtemAdapterClient({
        piswitchUrl: config.piswitchUrl,
        templateStore,
        activeStore,
        eventBroker,
        fetchFn: mockFetch,
      });

      const app = buildApp({
        config,
        templateStore,
        activeStore,
        eventBroker,
        atemClient,
      });

      await app.ready();

      // 1. Health check
      const healthRes = await app.inject({ method: "GET", url: "/health" });
      assert.equal(healthRes.statusCode, 200);
      const healthJson = JSON.parse(healthRes.body);
      assert.equal(healthJson.status, "ok");
      assert.equal(healthJson.service, "pigraphics");

      // 2. Status
      const statusRes = await app.inject({ method: "GET", url: "/api/v1/status" });
      assert.equal(statusRes.statusCode, 200);
      const statusJson = JSON.parse(statusRes.body);
      assert.ok(statusJson.templatesCount >= 4);

      // 3. Show graphic
      const showRes = await app.inject({
        method: "POST",
        url: "/api/v1/graphics/active/show",
        payload: {
          templateId: "lower-third-speaker",
          bindings: { speaker: "Testi Puhuja", title: "Pastori" },
        },
      });
      assert.equal(showRes.statusCode, 200);
      const showJson = JSON.parse(showRes.body);
      assert.equal(showJson.active, true);
      assert.equal(showJson.templateId, "lower-third-speaker");

      // 4. Check active list
      const activeRes = await app.inject({ method: "GET", url: "/api/v1/graphics/active" });
      assert.equal(activeRes.statusCode, 200);
      const activeList = JSON.parse(activeRes.body);
      assert.equal(activeList.length, 1);

      // 5. Test display HTML page
      const displayRes = await app.inject({ method: "GET", url: "/display" });
      assert.equal(displayRes.statusCode, 200);
      assert.ok(displayRes.headers["content-type"]?.includes("text/html"));
      assert.ok(displayRes.body.includes("Testi Puhuja"));

      // 6. Push to ATEM (Method 1)
      const atemPushRes = await app.inject({
        method: "POST",
        url: "/api/v1/graphics/atem/push",
        payload: {
          templateId: "lower-third-speaker",
          slot: 7,
          dsk: 1,
        },
      });
      assert.equal(atemPushRes.statusCode, 200);
      const atemJson = JSON.parse(atemPushRes.body);
      assert.equal(atemJson.ok, true);
      assert.equal(atemJson.slot, 7);

      // 6b. Push Canva graphic with DVE Flying Key
      const canvaPushRes = await app.inject({
        method: "POST",
        url: "/api/v1/graphics/canva/push",
        payload: {
          title: "Sunday Sermon Lower Third",
          movement: "fly-left",
          slot: 8,
          mediaPlayer: 1,
          keyer: "usk",
          usk: 1,
          autoHideMs: 7000,
        },
      });
      assert.equal(canvaPushRes.statusCode, 200);
      const canvaJson = JSON.parse(canvaPushRes.body);
      assert.equal(canvaJson.ok, true);
      assert.equal(canvaJson.slot, 8);
      assert.equal(canvaJson.movement, "fly-left");
      assert.equal(canvaJson.keyer, "usk");

      // 6c. Take Canva graphic off air
      const offAirRes = await app.inject({
        method: "POST",
        url: "/api/v1/graphics/canva/off-air",
        payload: { keyer: "usk", index: 1 },
      });
      assert.equal(offAirRes.statusCode, 200);

      // 7. Hide graphic
      const hideRes = await app.inject({
        method: "POST",
        url: `/api/v1/graphics/active/hide/${encodeURIComponent(showJson.instanceId)}`,
      });
      assert.equal(hideRes.statusCode, 200);

      await app.close();
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
