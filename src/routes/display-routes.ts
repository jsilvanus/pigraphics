import type { FastifyPluginAsync } from "fastify";
import type { ActiveGraphicsStore } from "../store/active-graphics-store.js";
import type { TemplateStore } from "../store/template-store.js";
import { compileMultiGraphicsToHtml, compileTemplateToHtml } from "../renderer/html-compiler.js";

interface DisplayQuery {
  mode?: "single-chroma" | "single-luma" | "chroma" | "luma" | "dual-fill-key" | undefined;
  keyColor?: string | undefined;
  width?: string | undefined;
  height?: string | undefined;
}

export const displayRoutes = (
  activeStore: ActiveGraphicsStore,
  templateStore: TemplateStore,
  pageBaseUrl: string
): FastifyPluginAsync => {
  return async (app) => {
    // Live multi-graphic display endpoint (for fffleet capture or preview)
    const handler = async (req: any, reply: any) => {
      const query = (req.query || {}) as DisplayQuery;
      const width = Number(query.width) || 1920;
      const height = Number(query.height) || 1080;

      let background = "transparent";
      if (query.mode === "single-chroma" || query.mode === "chroma") {
        background = query.keyColor || "#00B140";
      } else if (query.mode === "single-luma" || query.mode === "luma") {
        background = "#000000";
      }

      const active = activeStore.getActive();
      const instancesWithTemplates = active
        .map((instance) => {
          const template = templateStore.get(instance.templateId);
          return template ? { instance, template } : null;
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

      const html = compileMultiGraphicsToHtml(instancesWithTemplates, {
        width,
        height,
        background,
        serverUrl: pageBaseUrl,
        bindings: activeStore.getBindings(),
        includeSseClient: true,
      });

      return reply.type("text/html; charset=utf-8").send(html);
    };

    app.get("/display", handler);
    app.get("/overlay", handler);

    // Single template preview / display
    app.get<{ Params: { templateId: string }; Querystring: DisplayQuery }>(
      "/display/:templateId",
      async (req, reply) => {
        const template = templateStore.get(req.params.templateId);
        if (!template) {
          return reply.code(404).send("Template not found");
        }

        const width = Number(req.query.width) || template.width || 1920;
        const height = Number(req.query.height) || template.height || 1080;
        let background = "transparent";
        if (req.query.mode === "single-chroma" || req.query.mode === "chroma") {
          background = req.query.keyColor || "#00B140";
        } else if (req.query.mode === "single-luma" || req.query.mode === "luma") {
          background = "#000000";
        }

        const html = compileTemplateToHtml(template, {
          width,
          height,
          background,
          serverUrl: pageBaseUrl,
          bindings: activeStore.getBindings(),
          includeSseClient: true,
        });

        return reply.type("text/html; charset=utf-8").send(html);
      }
    );
  };
};
