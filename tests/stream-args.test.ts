import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import {
  buildStreamFfmpegArgs,
  FleetStreamSupervisor,
  resolveVideoEncoder,
} from "../src/fleet/fleet-client.js";
import { GraphicsEventBroker } from "../src/events.js";

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

  it("supports h264_nvenc encoder selection and GRAPHICS_VIDEO_ENCODER env", () => {
    assert.equal(resolveVideoEncoder(undefined, {}), "libx264");
    assert.equal(resolveVideoEncoder(undefined, { GRAPHICS_VIDEO_ENCODER: "h264_nvenc" }), "h264_nvenc");
    assert.equal(resolveVideoEncoder(undefined, { GRAPHICS_VIDEO_ENCODER: "nvenc" }), "h264_nvenc");
    assert.equal(resolveVideoEncoder("x264", { GRAPHICS_VIDEO_ENCODER: "nvenc" }), "libx264");

    const singleArgs = buildStreamFfmpegArgs({
      mode: "single-chroma",
      fps: 25,
      singleUrl: "rtmp://localhost:1935/live/graphics",
      encoder: "h264_nvenc",
    });
    assert.ok(singleArgs.includes("h264_nvenc"));
    assert.ok(!singleArgs.includes("libx264"));

    const dualArgs = buildStreamFfmpegArgs({
      mode: "dual-fill-key",
      fps: 25,
      encoder: "nvenc",
    });
    assert.equal(dualArgs.filter((a) => a === "h264_nvenc").length, 2);
  });

  it("falls back to libx264 when h264_nvenc fails at startup in FleetStreamSupervisor", async () => {
    const spawnedArgs: string[][] = [];
    const warnings: string[] = [];

    const fakeSpawn = (_cmd: string, args: string[]) => {
      spawnedArgs.push(args);
      const child = new EventEmitter() as any;
      child.kill = () => true;
      if (spawnedArgs.length === 1) {
        // Simulate h264_nvenc failing immediately on a CPU-only host
        setImmediate(() => child.emit("close", 1));
      }
      return child;
    };

    const supervisor = new FleetStreamSupervisor({
      pageBaseUrl: "http://127.0.0.1:3201",
      rtmpBase: "rtmp://127.0.0.1:1935/live",
      encoder: "h264_nvenc",
      spawnImpl: fakeSpawn as any,
      eventBroker: new GraphicsEventBroker(),
      logger: {
        info: () => {},
        warn: (msg: string) => warnings.push(msg),
        error: () => {},
      },
    });

    const status = await supervisor.startStream({
      mode: "single-chroma",
      outputs: { singleUrl: "rtmp://127.0.0.1:1935/live/graphics" },
    });
    assert.equal(status.running, true);

    await new Promise((r) => setTimeout(r, 20));

    assert.equal(spawnedArgs.length, 2);
    assert.ok(spawnedArgs[0]?.includes("h264_nvenc"));
    assert.ok(spawnedArgs[1]?.includes("libx264"));
    assert.ok(warnings.some((w) => w.includes("falling back to libx264")));
    assert.equal(supervisor.getStatus().running, true);

    await supervisor.stopStream();
  });
});
