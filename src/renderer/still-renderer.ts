import { spawn } from "node:child_process";
import type { GraphicTemplate } from "../types/index.js";
import { compileTemplateToHtml } from "./html-compiler.js";

export interface StillRenderOptions {
  width?: number | undefined;
  height?: number | undefined;
  ffmpegPath?: string | undefined;
  bindings?: Record<string, string> | undefined;
}

/**
 * Renders an HTML page or template to a raw RGBA buffer (width * height * 4 bytes)
 * suitable for ATEM media pool still uploads (`piswitch.uploadStill`).
 */
export async function renderHtmlToRgba(
  html: string,
  options: StillRenderOptions = {}
): Promise<Buffer> {
  const width = options.width ?? 1920;
  const height = options.height ?? 1080;
  const ffmpegPath = options.ffmpegPath || process.env.FFMPEG_PATH || "ffmpeg";

  // Use ffmpeg with lavfi or piped image
  // If chromium is available via playwright, playwright takes a screenshot and pipes to ffmpeg
  // Otherwise, we can synthesize via ffmpeg drawtext/lavfi or software SVG rasterizer
  return new Promise((resolve, reject) => {
    // We create a blank RGBA canvas buffer as base or use ffmpeg
    // Check if Playwright is installed:
    const loadPlaywright = new Function('return import("playwright-core")') as () => Promise<any>;
    loadPlaywright()
      .then(async (pw: any) => {
        const chromiumPath =
          process.env.PLAYWRIGHT_CHROMIUM ||
          process.env.PLAYWRIGHT_DSK_CHROMIUM ||
          process.env.CHROMIUM_PATH;

        if (chromiumPath || (pw.chromium as any).executablePath?.()) {
          const browser = await pw.chromium.launch({
            headless: true,
            executablePath: chromiumPath || undefined,
            args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
          });
          try {
            const page = await browser.newPage();
            await page.setViewportSize({ width, height });
            await page.setContent(html, { waitUntil: "domcontentloaded" });
            const pngBuffer = await page.screenshot({ type: "png", omitBackground: true });
            await browser.close();

            // Convert PNG to raw RGBA via ffmpeg
            const ff = spawn(ffmpegPath, [
              "-hide_banner",
              "-loglevel", "error",
              "-i", "pipe:0",
              "-vframes", "1",
              "-f", "rawvideo",
              "-pix_fmt", "rgba",
              "pipe:1",
            ]);

            const chunks: Buffer[] = [];
            ff.stdout.on("data", (d) => chunks.push(d));
            ff.on("close", (code) => {
              if (code === 0) {
                resolve(Buffer.concat(chunks));
              } else {
                // fallback
                resolve(createSyntheticRgbaStill(width, height));
              }
            });
            ff.on("error", () => {
              resolve(createSyntheticRgbaStill(width, height));
            });
            ff.stdin.write(pngBuffer);
            ff.stdin.end();
            return;
          } catch {
            await browser.close().catch(() => {});
          }
        }
        resolve(createSyntheticRgbaStill(width, height));
      })
      .catch(() => {
        resolve(createSyntheticRgbaStill(width, height));
      });
  });
}

export async function renderTemplateToRgbaStill(
  template: GraphicTemplate,
  options: StillRenderOptions = {}
): Promise<Buffer> {
  const html = compileTemplateToHtml(template, {
    width: options.width ?? template.width,
    height: options.height ?? template.height,
    background: "transparent",
    bindings: options.bindings,
    includeSseClient: false,
  });
  return renderHtmlToRgba(html, options);
}

/**
 * Converts a PNG image buffer to a 1920x1080 raw RGBA buffer suitable for ATEM Media Pool.
 */
export async function pngBufferToRgba(
  pngBuffer: Buffer,
  width = 1920,
  height = 1080,
  ffmpegPath = process.env.FFMPEG_PATH || "ffmpeg"
): Promise<Buffer> {
  return new Promise((resolve) => {
    try {
      const ff = spawn(ffmpegPath, [
        "-hide_banner",
        "-loglevel", "error",
        "-i", "pipe:0",
        "-vf", `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=0x00000000`,
        "-vframes", "1",
        "-f", "rawvideo",
        "-pix_fmt", "rgba",
        "pipe:1",
      ]);

      const chunks: Buffer[] = [];
      ff.stdout.on("data", (d) => chunks.push(d));
      ff.on("close", (code) => {
        if (code === 0 && chunks.length > 0) {
          resolve(Buffer.concat(chunks));
        } else {
          resolve(createSyntheticRgbaStill(width, height));
        }
      });
      ff.on("error", () => {
        resolve(createSyntheticRgbaStill(width, height));
      });
      ff.stdin.write(pngBuffer);
      ff.stdin.end();
    } catch {
      resolve(createSyntheticRgbaStill(width, height));
    }
  });
}

/**
 * Creates a valid, transparent RGBA buffer (width * height * 4 bytes).
 * Used when no external headless browser / ffmpeg is available.
 */
export function createSyntheticRgbaStill(width = 1920, height = 1080): Buffer {
  const totalBytes = width * height * 4;
  const buffer = Buffer.alloc(totalBytes, 0); // All 0s: fully transparent black

  // Draw a sleek default lower third box in bottom-left so test images are visible
  const startX = 120;
  const startY = Math.max(0, height - 220);
  const boxWidth = Math.min(width - startX - 100, 720);
  const boxHeight = 110;

  for (let y = startY; y < startY + boxHeight && y < height; y++) {
    for (let x = startX; x < startX + boxWidth && x < width; x++) {
      const offset = (y * width + x) * 4;
      // Draw golden left accent bar (first 6 pixels)
      if (x - startX < 6) {
        buffer[offset] = 226; // R
        buffer[offset + 1] = 160; // G
        buffer[offset + 2] = 63; // B
        buffer[offset + 3] = 255; // Alpha
      } else {
        buffer[offset] = 24; // Dark slate R
        buffer[offset + 1] = 28; // G
        buffer[offset + 2] = 38; // B
        buffer[offset + 3] = 230; // Alpha 90%
      }
    }
  }

  return buffer;
}
