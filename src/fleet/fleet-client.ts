import { spawn, type ChildProcess } from "node:child_process";
import { createFleet, type Fleet, type JobHandle } from "fffleet";
import type { StreamJobConfig, StreamJobStatus, StreamOutputMode } from "../types/index.js";
import type { GraphicsEventBroker } from "../events.js";

export interface BuildArgsOptions {
  mode: StreamOutputMode;
  fps?: number | undefined;
  singleUrl?: string | undefined;
  fillUrl?: string | undefined;
  keyUrl?: string | undefined;
}

/**
 * Builds ffmpeg arguments for Method 2 (single stream) or Method 3 (synchronized dual Fill + Key streams).
 */
export function buildStreamFfmpegArgs(options: BuildArgsOptions): string[] {
  const fps = Math.min(60, Math.max(1, options.fps ?? 25));
  const gop = fps * 2;

  if (options.mode === "dual-fill-key") {
    const fillUrl = options.fillUrl || "rtmp://127.0.0.1:1935/live/graphics-fill";
    const keyUrl = options.keyUrl || "rtmp://127.0.0.1:1935/live/graphics-key";

    return [
      "-y",
      "-f", "image2pipe",
      "-framerate", String(fps),
      "-i", "pipe:0",
      "-filter_complex",
      "[0:v]split=2[fill_in][key_in]; [fill_in]format=yuv420p[fill]; [key_in]alphaextract,format=yuv420p[key]",
      "-map", "[fill]",
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-tune", "zerolatency",
      "-g", String(gop),
      "-f", "flv", fillUrl,
      "-map", "[key]",
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-tune", "zerolatency",
      "-g", String(gop),
      "-f", "flv", keyUrl,
    ];
  }

  // Single stream (chroma or luma)
  const singleUrl = options.singleUrl || "rtmp://127.0.0.1:1935/live/graphics";
  return [
    "-y",
    "-f", "image2pipe",
    "-framerate", String(fps),
    "-i", "pipe:0",
    "-vf", "format=yuv420p",
    "-c:v", "libx264",
    "-preset", "ultrafast",
    "-tune", "zerolatency",
    "-g", String(gop),
    "-f", "flv", singleUrl,
  ];
}

export interface FleetSupervisorOptions {
  fffleetUrl?: string | undefined;
  fffleetToken?: string | undefined;
  pageBaseUrl: string;
  rtmpBase: string;
  ffmpegPath?: string | undefined;
  eventBroker: GraphicsEventBroker;
  logger?: { info: (...args: any[]) => void; warn: (...args: any[]) => void; error: (...args: any[]) => void } | undefined;
}

export class FleetStreamSupervisor {
  private readonly fleet: Fleet | null = null;
  private readonly pageBaseUrl: string;
  private readonly rtmpBase: string;
  private readonly ffmpegPath: string;
  private readonly eventBroker: GraphicsEventBroker;
  private readonly logger?: FleetSupervisorOptions["logger"] | undefined;

  private currentJob: JobHandle | null = null;
  private localProcess: ChildProcess | null = null;
  private localAbortController: AbortController | null = null;
  private currentStatus: StreamJobStatus;

  constructor(options: FleetSupervisorOptions) {
    this.pageBaseUrl = options.pageBaseUrl.replace(/\/+$/, "");
    this.rtmpBase = options.rtmpBase.replace(/\/+$/, "");
    this.ffmpegPath = options.ffmpegPath || "ffmpeg";
    this.eventBroker = options.eventBroker;
    this.logger = options.logger;

    if (options.fffleetUrl) {
      try {
        this.fleet = createFleet({
          url: options.fffleetUrl,
          ...(options.fffleetToken ? { token: options.fffleetToken } : {}),
        });
      } catch (err) {
        this.logger?.warn?.(`fffleet client initialization error: ${String(err)}`);
      }
    }

    this.currentStatus = {
      running: false,
      mode: "single-chroma",
      executor: this.fleet ? "fleet" : "local",
      outputs: {},
    };
  }

  getStatus(): StreamJobStatus {
    return { ...this.currentStatus };
  }

  async startStream(config: StreamJobConfig): Promise<StreamJobStatus> {
    if (this.currentStatus.running) {
      await this.stopStream();
    }

    const mode = config.mode || "single-chroma";
    const width = config.width || 1920;
    const height = config.height || 1080;
    const fps = config.fps || 25;
    const keyColor = config.keyColor || (mode === "single-luma" ? "#000000" : "#00B140");

    const singleUrl = config.outputs.singleUrl || `${this.rtmpBase}/graphics`;
    const fillUrl = config.outputs.fillUrl || `${this.rtmpBase}/graphics-fill`;
    const keyUrl = config.outputs.keyUrl || `${this.rtmpBase}/graphics-key`;

    const outputs = mode === "dual-fill-key" ? { fillUrl, keyUrl } : { singleUrl };
    const pageUrl = `${this.pageBaseUrl}/display?mode=${mode}&keyColor=${encodeURIComponent(keyColor)}`;

    if (this.fleet) {
      try {
        const jobId = `pigraphics-${Date.now()}`;
        const outputTargets =
          mode === "dual-fill-key"
            ? [{ url: fillUrl, label: "fill" }, { url: keyUrl, label: "key" }]
            : [{ url: singleUrl, label: "single" }];

        const job = await this.fleet.submit({
          id: jobId,
          kind: "stream",
          type: "dsk",
          owner: "pigraphics",
          labels: { service: "pigraphics", mode },
          dsk: {
            pageUrl,
            width,
            height,
            fps,
            background: mode === "dual-fill-key" ? "transparent" : keyColor,
            outputs: outputTargets,
          },
        });

        this.currentJob = job;
        this.currentStatus = {
          running: true,
          mode,
          jobId,
          executor: "fleet",
          outputs,
          startedAt: new Date().toISOString(),
        };

        this.eventBroker.emit("graphics.stream_status", this.currentStatus);

        job.done
          .then(() => {
            if (this.currentStatus.jobId === jobId) {
              this.currentStatus.running = false;
              this.eventBroker.emit("graphics.stream_status", this.currentStatus);
            }
          })
          .catch((err: unknown) => {
            if (this.currentStatus.jobId === jobId) {
              this.currentStatus.running = false;
              this.currentStatus.error = String(err);
              this.eventBroker.emit("graphics.stream_status", this.currentStatus);
            }
          });

        return this.getStatus();
      } catch (err) {
        this.logger?.warn?.(`fffleet submit failed (${String(err)}), falling back to local runner`);
      }
    }

    // Local execution fallback
    return this.startLocalRunner({ mode, width, height, fps, keyColor, singleUrl, fillUrl, keyUrl, pageUrl });
  }

  private async startLocalRunner(params: {
    mode: StreamOutputMode;
    width: number;
    height: number;
    fps: number;
    keyColor: string;
    singleUrl: string;
    fillUrl: string;
    keyUrl: string;
    pageUrl: string;
  }): Promise<StreamJobStatus> {
    this.localAbortController = new AbortController();
    const { signal } = this.localAbortController;
    const args = buildStreamFfmpegArgs({
      mode: params.mode,
      fps: params.fps,
      singleUrl: params.singleUrl,
      fillUrl: params.fillUrl,
      keyUrl: params.keyUrl,
    });

    try {
      const child = spawn(this.ffmpegPath, args, { stdio: ["pipe", "ignore", "pipe"] });
      this.localProcess = child;

      child.on("close", (code) => {
        this.currentStatus.running = false;
        this.eventBroker.emit("graphics.stream_status", this.currentStatus);
      });

      child.on("error", (err) => {
        this.currentStatus.running = false;
        this.currentStatus.error = err.message;
        this.eventBroker.emit("graphics.stream_status", this.currentStatus);
      });

      this.currentStatus = {
        running: true,
        mode: params.mode,
        jobId: `local-${Date.now()}`,
        executor: "local",
        outputs: params.mode === "dual-fill-key" ? { fillUrl: params.fillUrl, keyUrl: params.keyUrl } : { singleUrl: params.singleUrl },
        startedAt: new Date().toISOString(),
      };

      this.eventBroker.emit("graphics.stream_status", this.currentStatus);
      return this.getStatus();
    } catch (err) {
      this.currentStatus = {
        running: false,
        mode: params.mode,
        executor: "local",
        outputs: {},
        error: String(err),
      };
      return this.getStatus();
    }
  }

  async stopStream(): Promise<StreamJobStatus> {
    if (this.currentJob) {
      try {
        await this.currentJob.cancel();
      } catch {}
      this.currentJob = null;
    }

    if (this.localAbortController) {
      this.localAbortController.abort();
      this.localAbortController = null;
    }

    if (this.localProcess) {
      try {
        this.localProcess.kill("SIGTERM");
      } catch {}
      this.localProcess = null;
    }

    this.currentStatus.running = false;
    this.eventBroker.emit("graphics.stream_status", this.currentStatus);
    return this.getStatus();
  }
}
