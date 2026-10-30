import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildStreamFfmpegArgs } from "../src/fleet/fleet-client.js";

describe("Stream Args Builder", () => {
  it("builds Method 2 single-stream chroma/luma args", () => {
    const args = buildStreamFfmpegArgs({
      mode: "single-chroma",
      fps: 25,
      singleUrl: "rtmp://localhost:1935/live/graphics",
    });

    assert.ok(args.includes("-framerate"));
    assert.ok(args.includes("25"));
    assert.ok(args.includes("-vf"));
    assert.ok(args.includes("format=yuv420p"));
    assert.ok(args.includes("rtmp://localhost:1935/live/graphics"));
  });

  it("builds Method 3 dual synchronized fill and key stream args", () => {
    const args = buildStreamFfmpegArgs({
      mode: "dual-fill-key",
      fps: 30,
      fillUrl: "rtmp://localhost:1935/live/graphics-fill",
      keyUrl: "rtmp://localhost:1935/live/graphics-key",
    });

    assert.ok(args.includes("-filter_complex"));
    const filterComplex = args[args.indexOf("-filter_complex") + 1];
    assert.ok(filterComplex?.includes("split=2[fill_in][key_in]"));
    assert.ok(filterComplex?.includes("alphaextract,format=yuv420p[key]"));

    assert.ok(args.includes("rtmp://localhost:1935/live/graphics-fill"));
    assert.ok(args.includes("rtmp://localhost:1935/live/graphics-key"));
  });
});
