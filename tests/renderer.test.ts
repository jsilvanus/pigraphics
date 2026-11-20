import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { compileTemplateToHtml, compileMultiGraphicsToHtml, renderLayerToHtml } from "../src/renderer/html-compiler.js";
import {
  clearStillRgbaCache,
  createSyntheticRgbaStill,
  getStillRgbaCacheStats,
  pngBufferToRgba,
  renderHtmlToRgba,
} from "../src/renderer/still-renderer.js";
import type { GraphicTemplate, ActiveGraphicInstance } from "../src/types/index.js";

describe("Renderer", () => {
  const sampleTemplate: GraphicTemplate = {
    id: "test-strap",
    name: "Test Strap",
    width: 1920,
    height: 1080,
    background: "transparent",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    layers: [
      {
        id: "box",
        type: "rect",
        x: 100,
        y: 800,
        width: 600,
        height: 100,
        style: { background: "#112233" },
        animation: { entrance: "slideInLeft", entranceDurationMs: 400 },
      },
      {
        id: "name",
        type: "text",
        x: 120,
        y: 820,
        text: "Default Name",
        binding: "speaker",
        animation: { entrance: "fadeIn", entranceDurationMs: 600 },
      },
    ],
  };

  it("compiles a template into HTML with broadcast CSS keyframes and SSE script", () => {
    const html = compileTemplateToHtml(sampleTemplate, {
      serverUrl: "http://localhost:3201",
      bindings: { speaker: "Juha Itäleino" },
    });

    assert.ok(html.includes("<!DOCTYPE html>"));
    assert.ok(html.includes("@keyframes slideInLeft"));
    assert.ok(html.includes("@keyframes fadeIn"));
    assert.ok(html.includes('data-binding="speaker"'));
    assert.ok(html.includes("Juha Itäleino"), "Should populate binding initial value");
    assert.ok(html.includes("/api/v1/graphics/events"), "Should embed SSE subscriber URL");
  });

  it("compiles multiple active graphics simultaneously", () => {
    const instance1: ActiveGraphicInstance = {
      instanceId: "inst-1",
      templateId: "test-strap",
      active: true,
      bindings: { speaker: "Speaker One" },
    };
    const instance2: ActiveGraphicInstance = {
      instanceId: "inst-2",
      templateId: "test-strap",
      active: true,
      bindings: { speaker: "Speaker Two" },
    };

    const html = compileMultiGraphicsToHtml(
      [
        { instance: instance1, template: sampleTemplate },
        { instance: instance2, template: sampleTemplate },
      ],
      {
        serverUrl: "http://localhost:3201",
      }
    );

    assert.ok(html.includes('id="inst-1"'));
    assert.ok(html.includes('id="inst-2"'));
    assert.ok(html.includes("Speaker One"));
    assert.ok(html.includes("Speaker Two"));
  });

  it("creates a valid raw RGBA still buffer", () => {
    const width = 1920;
    const height = 1080;
    const buf = createSyntheticRgbaStill(width, height);
    assert.equal(buf.length, width * height * 4, "Raw RGBA buffer must be width * height * 4 bytes");
  });

  it("caches rendered HTML RGBA stills by SHA-256 of (html, width, height)", async () => {
    clearStillRgbaCache();
    const html = "<html><body><h1>Lower Third</h1></body></html>";

    const first = await renderHtmlToRgba(html, { width: 320, height: 180 });
    const statsAfterFirst = getStillRgbaCacheStats();
    assert.equal(statsAfterFirst.misses, 1);
    assert.equal(statsAfterFirst.hits, 0);
    assert.equal(statsAfterFirst.size, 1);

    const second = await renderHtmlToRgba(html, { width: 320, height: 180 });
    const statsAfterSecond = getStillRgbaCacheStats();
    assert.equal(statsAfterSecond.hits, 1);
    assert.equal(second, first, "Cache hit should return the exact cached Buffer instance");

    // Different dimensions must miss the cache
    await renderHtmlToRgba(html, { width: 640, height: 360 });
    assert.equal(getStillRgbaCacheStats().misses, 2);
    assert.equal(getStillRgbaCacheStats().size, 2);
  });

  it("caches pngBufferToRgba results by SHA-256 of (pngBuffer, width, height)", async () => {
    clearStillRgbaCache();
    const fakePng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);

    const first = await pngBufferToRgba(fakePng, 320, 180, "nonexistent-ffmpeg-binary");
    const second = await pngBufferToRgba(fakePng, 320, 180, "nonexistent-ffmpeg-binary");

    assert.equal(second, first);
    const stats = getStillRgbaCacheStats();
    assert.equal(stats.misses, 1);
    assert.equal(stats.hits, 1);
  });
});
