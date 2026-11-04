import type { FastifyPluginAsync } from "fastify";
import type { ActiveGraphicsStore } from "../store/active-graphics-store.js";
import type { TemplateStore } from "../store/template-store.js";

interface ShowBody {
  templateId: string;
  instanceId?: string | undefined;
  layerOverrides?: Record<string, any> | undefined;
  bindings?: Record<string, string> | undefined;
  autoHideMs?: number | undefined;
}

export const activeRoutes = (
  activeStore: ActiveGraphicsStore,
  templateStore: TemplateStore
): FastifyPluginAsync => {
  return async (app) => {
    app.get("/api/v1/graphics/active", async () => {
      return activeStore.getActive();
    });

    app.post<{ Body: ShowBody }>("/api/v1/graphics/active/show", async (req, reply) => {
      const { templateId, instanceId, layerOverrides, bindings, autoHideMs } = req.body || {};
      if (!templateId) {
        return reply.code(400).send({ error: { code: "INVALID_BODY", message: "templateId is required" } });
      }

      const template = templateStore.get(templateId);
      if (!template) {
        return reply.code(404).send({ error: { code: "TEMPLATE_NOT_FOUND", message: `Template ${templateId} not found` } });
      }

      const instance = activeStore.show(templateId, {
        instanceId,
        layerOverrides,
        bindings,
        autoHideMs,
      });

      return reply.code(200).send(instance);
    });

    app.post<{ Params: { instanceId: string } }>("/api/v1/graphics/active/hide/:instanceId", async (req, reply) => {
      const ok = activeStore.hide(req.params.instanceId);
      if (!ok) {
        return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Active graphic instance not found" } });
      }
      return reply.code(200).send({ ok: true, instanceId: req.params.instanceId });
    });

    app.post("/api/v1/graphics/active/clear", async (_req, reply) => {
      activeStore.clear();
      return reply.code(200).send({ ok: true });
    });

    app.get("/api/v1/graphics/bindings", async () => {
      return activeStore.getBindings();
    });

    app.post<{ Body: { bindings: Record<string, string> } }>("/api/v1/graphics/bindings", async (req, reply) => {
      const bindings = req.body?.bindings;
      if (!bindings || typeof bindings !== "object") {
        return reply.code(400).send({ error: { code: "INVALID_BODY", message: "bindings object is required" } });
      }
      activeStore.updateBindings(bindings);
      return reply.code(200).send({ ok: true, bindings: activeStore.getBindings() });
    });

    // Upstream-compatible convenience endpoints for picontrol-mcp
    app.get("/api/v1/graphics", async () => {
      return {
        active: activeStore.getActive(),
        bindings: activeStore.getBindings(),
      };
    });

    app.post<{
      Body: {
        action: "show" | "hide";
        templateId?: string;
        title?: string;
        subtitle?: string;
        durationMs?: number;
      };
    }>("/api/v1/graphics/lower-third", async (req, reply) => {
      const { action, templateId, title, subtitle, durationMs } = req.body || {};
      if (action === "hide") {
        for (const inst of activeStore.getActive()) {
          if (inst.templateId.includes("lower-third") || inst.templateId.includes("speaker")) {
            activeStore.hide(inst.instanceId);
          }
        }
        return reply.code(200).send({ ok: true });
      }

      const targetTemplate = templateId || "lower-third-speaker";
      const bindings: Record<string, string> = {};
      if (title) bindings["speaker"] = title;
      if (subtitle) bindings["title"] = subtitle;

      const instance = activeStore.show(targetTemplate, {
        bindings,
        autoHideMs: durationMs,
      });
      return reply.code(200).send({ ok: true, instance });
    });

    app.post<{
      Body: {
        action: "show" | "hide";
        type?: string;
        content?: string;
      };
    }>("/api/v1/graphics/overlay", async (req, reply) => {
      const { action, type, content } = req.body || {};
      if (action === "hide") {
        for (const inst of activeStore.getActive()) {
          if (inst.templateId.includes("overlay") || inst.templateId.includes("scripture") || inst.templateId.includes("hymn")) {
            activeStore.hide(inst.instanceId);
          }
        }
        return reply.code(200).send({ ok: true });
      }

      let templateId = "scripture-reading";
      const bindings: Record<string, string> = {};
      if (type === "hymn") {
        templateId = "hymn-ticker";
        bindings["hymn_text"] = content || "";
      } else {
        bindings["scripture_text"] = content || "";
      }

      const instance = activeStore.show(templateId, {
        bindings,
      });
      return reply.code(200).send({ ok: true, instance });
    });
  };
};
