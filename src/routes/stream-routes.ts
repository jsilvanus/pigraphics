import type { FastifyPluginAsync } from "fastify";
import type { FleetStreamSupervisor } from "../fleet/fleet-client.js";
import type { StreamJobConfig } from "../types/index.js";

export const streamRoutes = (fleetSupervisor: FleetStreamSupervisor): FastifyPluginAsync => {
  return async (app) => {
    app.get("/api/v1/graphics/stream/status", async () => {
      return fleetSupervisor.getStatus();
    });

    app.post<{ Body: StreamJobConfig }>("/api/v1/graphics/stream/start", async (req, reply) => {
      const config = req.body;
      if (!config || !config.mode) {
        return reply.code(400).send({
          error: { code: "INVALID_BODY", message: "mode is required ('single-chroma', 'single-luma', or 'dual-fill-key')" },
        });
      }

      try {
        const status = await fleetSupervisor.startStream(config);
        return reply.code(200).send(status);
      } catch (err) {
        return reply.code(500).send({
          error: { code: "STREAM_START_FAILED", message: err instanceof Error ? err.message : String(err) },
        });
      }
    });

    app.post("/api/v1/graphics/stream/stop", async () => {
      const status = await fleetSupervisor.stopStream();
      return status;
    });
  };
};
