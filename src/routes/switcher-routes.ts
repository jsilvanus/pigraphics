import type { FastifyPluginAsync } from "fastify";
import type { AtemAdapterClient } from "../switcher/piswitch-client.js";
import type { AtemPushOptions } from "../types/index.js";

interface PushBody extends AtemPushOptions {
  templateId: string;
}

export const switcherRoutes = (atemClient: AtemAdapterClient): FastifyPluginAsync => {
  return async (app) => {
    app.post<{ Body: PushBody }>("/api/v1/graphics/atem/push", async (req, reply) => {
      const { templateId, ...options } = req.body || {};
      if (!templateId) {
        return reply.code(400).send({ error: { code: "INVALID_BODY", message: "templateId is required" } });
      }

      try {
        const result = await atemClient.pushTemplateToAtem(templateId, options);
        return reply.code(200).send(result);
      } catch (err) {
        return reply.code(500).send({
          error: { code: "ATEM_PUSH_FAILED", message: err instanceof Error ? err.message : String(err) },
        });
      }
    });

    app.post<{ Body: { dsk?: number; onAir?: boolean } }>("/api/v1/graphics/atem/dsk/on-air", async (req, reply) => {
      const dsk = req.body?.dsk ?? 1;
      const onAir = req.body?.onAir !== false;
      const ok = await atemClient.setDskOnAir(dsk, onAir);
      return reply.code(200).send({ ok, dsk, onAir });
    });

    app.post<{ Body: { dsk?: number; tie?: boolean } }>("/api/v1/graphics/atem/dsk/tie", async (req, reply) => {
      const dsk = req.body?.dsk ?? 1;
      const tie = req.body?.tie !== false;
      const ok = await atemClient.setDskTie(dsk, tie);
      return reply.code(200).send({ ok, dsk, tie });
    });

    app.post("/api/v1/graphics/atem/auto", async (_req, reply) => {
      const ok = await atemClient.triggerAutoTransition();
      return reply.code(200).send({ ok });
    });
  };
};
