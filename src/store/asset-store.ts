import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

export interface AssetMetadata {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export class AssetStore {
  private readonly dir: string;

  constructor(dir: string) {
    this.dir = dir;
    if (!existsSync(this.dir)) {
      mkdirSync(this.dir, { recursive: true });
    }
  }

  list(): AssetMetadata[] {
    const files = readdirSync(this.dir);
    const result: AssetMetadata[] = [];
    for (const file of files) {
      if (file.endsWith(".meta.json")) {
        try {
          const content = readFileSync(join(this.dir, file), "utf-8");
          result.push(JSON.parse(content) as AssetMetadata);
        } catch {}
      }
    }
    return result;
  }

  get(id: string): { metadata: AssetMetadata; buffer: Buffer } | undefined {
    const metaPath = join(this.dir, `${id}.meta.json`);
    const dataPath = join(this.dir, id);
    if (!existsSync(metaPath) || !existsSync(dataPath)) return undefined;

    const metadata = JSON.parse(readFileSync(metaPath, "utf-8")) as AssetMetadata;
    const buffer = readFileSync(dataPath);
    return { metadata, buffer };
  }

  save(name: string, mimeType: string, buffer: Buffer): AssetMetadata {
    const id = randomUUID();
    const metadata: AssetMetadata = {
      id,
      name,
      mimeType,
      sizeBytes: buffer.length,
      createdAt: new Date().toISOString(),
    };
    writeFileSync(join(this.dir, id), buffer);
    writeFileSync(join(this.dir, `${id}.meta.json`), JSON.stringify(metadata, null, 2), "utf-8");
    return metadata;
  }

  delete(id: string): boolean {
    const metaPath = join(this.dir, `${id}.meta.json`);
    const dataPath = join(this.dir, id);
    let deleted = false;
    if (existsSync(metaPath)) {
      unlinkSync(metaPath);
      deleted = true;
    }
    if (existsSync(dataPath)) {
      unlinkSync(dataPath);
      deleted = true;
    }
    return deleted;
  }
}
