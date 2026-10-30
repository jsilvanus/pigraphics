import type { FastifyPluginAsync } from "fastify";
import type { AtemAdapterClient } from "../switcher/piswitch-client.js";
import type { CanvaGraphicPushOptions } from "../types/index.js";
import { createSyntheticRgbaStill } from "../renderer/still-renderer.js";

export const canvaRoutes = (atemClient?: AtemAdapterClient): FastifyPluginAsync => {
  return async (app) => {
    /**
     * POST /api/v1/graphics/canva/push
     * Accepts a Canva-exported PNG graphic (base64 or URL) and pushes to ATEM Media Pool
     * with Flying Key or DSK motion.
     */
    app.post<{ Body: CanvaGraphicPushOptions }>("/api/v1/graphics/canva/push", async (req, reply) => {
      if (!atemClient) {
        return reply.code(503).send({
          error: { code: "SERVICE_UNAVAILABLE", message: "AtemAdapterClient is not configured" },
        });
      }

      const { title, image, imageUrl, movement, autoHideMs, slot, mediaPlayer, keyer, usk } = req.body || {};

      let buffer: Buffer;

      if (image && typeof image === "string") {
        const base64Data = image.includes("base64,") ? image.split("base64,")[1] ?? "" : image;
        buffer = Buffer.from(base64Data, "base64");
      } else if (imageUrl && typeof imageUrl === "string") {
        try {
          const res = await fetch(imageUrl);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const ab = await res.arrayBuffer();
          buffer = Buffer.from(ab);
        } catch (err) {
          app.log.warn(`Failed to fetch imageUrl ${imageUrl}: ${String(err)}`);
          buffer = createSyntheticRgbaStill(1920, 1080);
        }
      } else {
        // Fallback to synthetic transparent graphic buffer
        buffer = createSyntheticRgbaStill(1920, 1080);
      }

      try {
        const result = await atemClient.pushGraphicWithFlyKey(buffer, {
          title: title || "Canva Graphic",
          movement: movement || "fly-left",
          autoHideMs: typeof autoHideMs === "number" ? autoHideMs : 7000,
          slot,
          mediaPlayer,
          keyer,
          usk,
        });

        return reply.code(200).send(result);
      } catch (err) {
        app.log.error(err, "Failed to push graphic with flying key");
        return reply.code(500).send({
          error: { code: "PUSH_FAILED", message: err instanceof Error ? err.message : String(err) },
        });
      }
    });

    /**
     * POST /api/v1/graphics/canva/off-air
     * Takes the active keyer (USK or DSK) off air.
     */
    app.post<{ Body: { keyer?: "usk" | "dsk"; index?: number } }>(
      "/api/v1/graphics/canva/off-air",
      async (req, reply) => {
        if (!atemClient) {
          return reply.code(503).send({
            error: { code: "SERVICE_UNAVAILABLE", message: "AtemAdapterClient is not configured" },
          });
        }

        const keyer = req.body?.keyer ?? "usk";
        const index = req.body?.index ?? 1;

        await atemClient.takeOffAir(keyer, index);
        return reply.code(200).send({ ok: true, offAir: true, keyer, index });
      }
    );
  };
};
