import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { GraphicTemplate } from "../types/index.js";

const DEFAULT_TEMPLATES: GraphicTemplate[] = [
  {
    id: "lower-third-speaker",
    name: "Speaker Lower Third",
    description: "Standard broadcast lower-third strap with speaker name and subtitle/role",
    width: 1920,
    height: 1080,
    background: "transparent",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ["lower-third", "speaker", "liturgy"],
    layers: [
      {
        id: "strap-bg",
        type: "rect",
        x: 120,
        y: 860,
        width: 720,
        height: 110,
        style: {
          background: "linear-gradient(135deg, rgba(20, 24, 33, 0.92) 0%, rgba(35, 42, 58, 0.88) 100%)",
          "border-left": "6px solid #e2a03f",
          "border-radius": "0 8px 8px 0",
          "box-shadow": "0 8px 24px rgba(0, 0, 0, 0.45)",
          backdropFilter: "blur(8px)",
        },
        animation: {
          entrance: "slideInLeft",
          entranceDurationMs: 600,
          exit: "slideOutLeft",
          exitDurationMs: 400,
        },
      },
      {
        id: "speaker-name",
        type: "text",
        x: 150,
        y: 875,
        width: 660,
        height: 44,
        text: "Pastori Nimi",
        binding: "speaker",
        style: {
          color: "#ffffff",
          "font-family": "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          "font-size": "32px",
          "font-weight": "700",
          "letter-spacing": "0.5px",
          "text-shadow": "0 2px 4px rgba(0,0,0,0.6)",
        },
        animation: {
          entrance: "fadeIn",
          entranceDurationMs: 800,
          entranceDelayMs: 200,
        },
      },
      {
        id: "speaker-title",
        type: "text",
        x: 150,
        y: 924,
        width: 660,
        height: 32,
        text: "Riihimäen Keskuskirkko",
        binding: "title",
        style: {
          color: "#e2a03f",
          "font-family": "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          "font-size": "20px",
          "font-weight": "500",
          "letter-spacing": "0.3px",
          "text-transform": "uppercase",
        },
        animation: {
          entrance: "fadeIn",
          entranceDurationMs: 800,
          entranceDelayMs: 300,
        },
      },
    ],
  },
  {
    id: "scripture-reading",
    name: "Scripture Reading Strap",
    description: "Lower third display for liturgical scripture readings and biblical citations",
    width: 1920,
    height: 1080,
    background: "transparent",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ["scripture", "bible", "liturgy"],
    layers: [
      {
        id: "scripture-box",
        type: "rect",
        x: 120,
        y: 840,
        width: 900,
        height: 140,
        style: {
          background: "linear-gradient(90deg, rgba(16, 20, 28, 0.94) 0%, rgba(28, 35, 48, 0.85) 100%)",
          "border-left": "6px solid #4a90e2",
          "border-radius": "0 8px 8px 0",
          "box-shadow": "0 8px 24px rgba(0, 0, 0, 0.4)",
        },
        animation: {
          entrance: "slideInUp",
          entranceDurationMs: 500,
          exit: "slideOutDown",
          exitDurationMs: 400,
        },
      },
      {
        id: "scripture-citation",
        type: "text",
        x: 150,
        y: 855,
        width: 840,
        height: 36,
        text: "Joh. 3:16",
        binding: "citation",
        style: {
          color: "#4a90e2",
          "font-family": "system-ui, -apple-system, sans-serif",
          "font-size": "26px",
          "font-weight": "700",
        },
      },
      {
        id: "scripture-text",
        type: "text",
        x: 150,
        y: 895,
        width: 840,
        height: 70,
        text: "Sillä niin on Jumala maailmaa rakastanut...",
        binding: "passage",
        style: {
          color: "#f0f2f5",
          "font-family": "Georgia, serif",
          "font-size": "22px",
          "font-style": "italic",
          "line-height": "1.35",
        },
      },
    ],
  },
  {
    id: "corner-logo",
    name: "Corner Watermark / Bug",
    description: "Subtle top-right church logo / broadcast identification bug",
    width: 1920,
    height: 1080,
    background: "transparent",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ["bug", "logo"],
    layers: [
      {
        id: "logo-box",
        type: "rect",
        x: 1680,
        y: 60,
        width: 160,
        height: 60,
        style: {
          background: "rgba(0, 0, 0, 0.4)",
          "border-radius": "6px",
          display: "flex",
          "align-items": "center",
          "justify-content": "center",
          border: "1px solid rgba(255, 255, 255, 0.15)",
        },
        animation: {
          entrance: "fadeIn",
          entranceDurationMs: 1000,
        },
      },
      {
        id: "logo-text",
        type: "text",
        x: 1690,
        y: 78,
        width: 140,
        height: 24,
        text: "KESKUSKIRKKO",
        binding: "station_name",
        style: {
          color: "rgba(255, 255, 255, 0.85)",
          "font-family": "system-ui, sans-serif",
          "font-size": "14px",
          "font-weight": "800",
          "letter-spacing": "2px",
          "text-align": "center",
        },
      },
    ],
  },
  {
    id: "ticker-banner",
    name: "Bottom News / Hymn Ticker",
    description: "Full-width bottom ribbon for notices, hymns, and prayer requests",
    width: 1920,
    height: 1080,
    background: "transparent",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ["ticker", "banner", "hymn"],
    layers: [
      {
        id: "ticker-bar",
        type: "rect",
        x: 0,
        y: 990,
        width: 1920,
        height: 90,
        style: {
          background: "rgba(12, 16, 24, 0.95)",
          "border-top": "4px solid #e2a03f",
          "box-shadow": "0 -4px 20px rgba(0, 0, 0, 0.5)",
        },
        animation: {
          entrance: "slideInUp",
          entranceDurationMs: 500,
          exit: "slideOutDown",
          exitDurationMs: 400,
        },
      },
      {
        id: "ticker-title",
        type: "text",
        x: 40,
        y: 1018,
        width: 320,
        height: 40,
        text: "VIRSI 332",
        binding: "hymn_number",
        style: {
          color: "#e2a03f",
          "font-family": "system-ui, sans-serif",
          "font-size": "26px",
          "font-weight": "800",
          "letter-spacing": "1.5px",
        },
      },
      {
        id: "ticker-content",
        type: "text",
        x: 360,
        y: 1022,
        width: 1520,
        height: 36,
        text: "1. Herraa hyvää kiittäkää, iloiten häntä ylistäkää!",
        binding: "hymn_text",
        style: {
          color: "#ffffff",
          "font-family": "Georgia, serif",
          "font-size": "24px",
          "font-weight": "400",
        },
      },
    ],
  },
];

export class TemplateStore {
  private readonly dir: string;
  private readonly templates = new Map<string, GraphicTemplate>();

  constructor(dir: string) {
    this.dir = dir;
    this.init();
  }

  private init(): void {
    if (!existsSync(this.dir)) {
      mkdirSync(this.dir, { recursive: true });
    }

    const files = readdirSync(this.dir).filter((f) => f.endsWith(".json"));
    if (files.length === 0) {
      // Seed default broadcast templates
      for (const t of DEFAULT_TEMPLATES) {
        this.save(t);
      }
    } else {
      for (const file of files) {
        try {
          const content = readFileSync(join(this.dir, file), "utf-8");
          const template = JSON.parse(content) as GraphicTemplate;
          this.templates.set(template.id, template);
        } catch {
          // ignore corrupted files on startup
        }
      }
    }
  }

  list(): GraphicTemplate[] {
    return Array.from(this.templates.values());
  }

  get(id: string): GraphicTemplate | undefined {
    return this.templates.get(id);
  }

  save(template: GraphicTemplate): GraphicTemplate {
    const now = new Date().toISOString();
    const updated: GraphicTemplate = {
      ...template,
      updatedAt: now,
      createdAt: template.createdAt || now,
    };
    this.templates.set(updated.id, updated);
    writeFileSync(join(this.dir, `${updated.id}.json`), JSON.stringify(updated, null, 2), "utf-8");
    return updated;
  }

  delete(id: string): boolean {
    if (!this.templates.has(id)) return false;
    this.templates.delete(id);
    const filePath = join(this.dir, `${id}.json`);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
    return true;
  }
}
