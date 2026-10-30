import type { FastifyPluginAsync } from "fastify";
import type { GraphicsEventBroker } from "../events.js";

export const eventRoutes = (eventBroker: GraphicsEventBroker): FastifyPluginAsync => {
  return async (app) => {
    app.get("/api/v1/graphics/events", async (req, reply) => {
      reply.raw.setHeader("Content-Type", "text/event-stream");
      reply.raw.setHeader("Cache-Control", "no-cache");
      reply.raw.setHeader("Connection", "keep-alive");
      reply.raw.setHeader("Access-Control-Allow-Origin", "*");

      // Send initial connection event
      reply.raw.write(`event: connected\ndata: ${JSON.stringify({ time: new Date().toISOString() })}\n\n`);

      const unsubscribe = eventBroker.subscribe((event) => {
        try {
          reply.raw.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
        } catch {
          unsubscribe();
        }
      });

      // Keepalive ping every 15 seconds
      const pingTimer = setInterval(() => {
        try {
          reply.raw.write(": ping\n\n");
        } catch {
          clearInterval(pingTimer);
          unsubscribe();
        }
      }, 15000);

      req.raw.on("close", () => {
        clearInterval(pingTimer);
        unsubscribe();
      });
    });
  };
};
