import type { FastifyPluginAsync } from "fastify";
import type { TemplateStore } from "../store/template-store.js";
import type { GraphicTemplate } from "../types/index.js";

export const templateRoutes = (templateStore: TemplateStore): FastifyPluginAsync => {
  return async (app) => {
    app.get("/api/v1/graphics/templates", async () => {
      return templateStore.list();
    });

    app.get<{ Params: { id: string } }>("/api/v1/graphics/templates/:id", async (req, reply) => {
      const template = templateStore.get(req.params.id);
      if (!template) {
        return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Template not found" } });
      }
      return template;
    });

    app.post<{ Body: GraphicTemplate }>("/api/v1/graphics/templates", async (req, reply) => {
      const body = req.body;
      if (!body || !body.id || !body.name || !Array.isArray(body.layers)) {
        return reply.code(400).send({
          error: { code: "INVALID_BODY", message: "Template requires id, name, and layers array" },
        });
      }
      const saved = templateStore.save(body);
      return reply.code(201).send(saved);
    });

    app.delete<{ Params: { id: string } }>("/api/v1/graphics/templates/:id", async (req, reply) => {
      const ok = templateStore.delete(req.params.id);
      if (!ok) {
        return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Template not found" } });
      }
      return reply.code(200).send({ ok: true, id: req.params.id });
    });
  };
};
