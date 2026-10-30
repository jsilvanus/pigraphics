import { resolve } from "node:path";

export interface Config {
  port: number;
  host: string;
  pageBaseUrl: string;
  dataDir: string;
  templatesDir: string;
  assetsDir: string;
  gatewayUrl: string;
  piswitchUrl: string;
  fffleetUrl?: string | undefined;
  fffleetToken?: string | undefined;
  rtmpBase: string;
  ffmpegPath: string;
}

export function loadConfig(env = process.env): Config {
  const port = Number(env.PIGRAPHICS_PORT) || 3107;
  const host = env.PIGRAPHICS_HOST || "0.0.0.0";
  const pageBaseUrl = (env.PIGRAPHICS_PAGE_BASE_URL || `http://localhost:${port}`).replace(/\/+$/, "");
  const dataDir = resolve(process.cwd(), env.PIGRAPHICS_DATA_DIR || "data");
  const templatesDir = resolve(dataDir, "templates");
  const assetsDir = resolve(dataDir, "assets");

  return {
    port,
    host,
    pageBaseUrl,
    dataDir,
    templatesDir,
    assetsDir,
    gatewayUrl: (env.PIGATEWAY_URL || "http://localhost:3100").replace(/\/+$/, ""),
    piswitchUrl: (env.PISWITCH_URL || "http://localhost:3106").replace(/\/+$/, ""),
    fffleetUrl: env.FFFLEET_URL ? env.FFFLEET_URL.replace(/\/+$/, "") : undefined,
    fffleetToken: env.FFFLEET_TOKEN || undefined,
    rtmpBase: (env.GRAPHICS_RTMP_BASE || "rtmp://localhost:1935/live").replace(/\/+$/, ""),
    ffmpegPath: env.FFMPEG_PATH || "ffmpeg",
  };
}
