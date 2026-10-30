import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TemplateStore } from "../src/store/template-store.js";
import type { GraphicTemplate } from "../src/types/index.js";

describe("TemplateStore", () => {
  it("initializes and seeds default broadcast templates", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "pigraphics-tpl-"));
    try {
      const store = new TemplateStore(tempDir);
      const list = store.list();
      assert.ok(list.length >= 4, "Should seed at least 4 default broadcast templates");

      const speakerTpl = store.get("lower-third-speaker");
      assert.ok(speakerTpl, "Should have lower-third-speaker template");
      assert.equal(speakerTpl.width, 1920);
      assert.equal(speakerTpl.height, 1080);
      assert.ok(speakerTpl.layers.some((l) => l.binding === "speaker"));
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("can create, retrieve, update, and delete custom templates", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "pigraphics-tpl-"));
    try {
      const store = new TemplateStore(tempDir);
      const custom: GraphicTemplate = {
        id: "custom-lower-third",
        name: "Custom Lower Third",
        width: 1920,
        height: 1080,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        layers: [
          {
            id: "text-1",
            type: "text",
            x: 100,
            y: 900,
            text: "Hello World",
            binding: "custom_text",
          },
        ],
      };

      store.save(custom);
      const fetched = store.get("custom-lower-third");
      assert.ok(fetched);
      assert.equal(fetched.name, "Custom Lower Third");
      assert.equal(fetched.layers[0]?.binding, "custom_text");

      const deleted = store.delete("custom-lower-third");
      assert.equal(deleted, true);
      assert.equal(store.get("custom-lower-third"), undefined);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
