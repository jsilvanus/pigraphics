import type { FastifyPluginAsync } from "fastify";
import type { AssetStore } from "../store/asset-store.js";

interface AssetUploadJsonBody {
  name: string;
  mimeType: string;
  dataBase64: string;
}

export const assetRoutes = (assetStore: AssetStore): FastifyPluginAsync => {
  return async (app) => {
    app.get("/api/v1/graphics/assets", async () => {
      return assetStore.list();
    });

    app.get<{ Params: { id: string } }>("/api/v1/graphics/assets/:id", async (req, reply) => {
      const asset = assetStore.get(req.params.id);
      if (!asset) {
        return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Asset not found" } });
      }
      return reply.type(asset.metadata.mimeType).send(asset.buffer);
    });

    // Upload via JSON (Base64)
    app.post<{ Body: AssetUploadJsonBody }>("/api/v1/graphics/assets", async (req, reply) => {
      const { name, mimeType, dataBase64 } = req.body || {};
      if (!name || !dataBase64) {
        return reply.code(400).send({
          error: { code: "INVALID_BODY", message: "name and dataBase64 are required" },
        });
      }

      const buffer = Buffer.from(dataBase64, "base64");
      const meta = assetStore.save(name, mimeType || "image/png", buffer);
      return reply.code(201).send(meta);
    });

    app.delete<{ Params: { id: string } }>("/api/v1/graphics/assets/:id", async (req, reply) => {
      const ok = assetStore.delete(req.params.id);
      if (!ok) {
        return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Asset not found" } });
      }
      return reply.code(200).send({ ok: true, id: req.params.id });
    });
  };
};
