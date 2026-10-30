import type { AtemPushOptions, GraphicTemplate } from "../types/index.js";
import type { TemplateStore } from "../store/template-store.js";
import type { ActiveGraphicsStore } from "../store/active-graphics-store.js";
import type { GraphicsEventBroker } from "../events.js";
import { renderTemplateToRgbaStill, createSyntheticRgbaStill } from "../renderer/still-renderer.js";

export interface PiswitchClientOptions {
  piswitchUrl: string;
  templateStore: TemplateStore;
  activeStore: ActiveGraphicsStore;
  eventBroker: GraphicsEventBroker;
  fetchFn?: typeof fetch | undefined;
  logger?: { info: (...args: any[]) => void; warn: (...args: any[]) => void; error: (...args: any[]) => void } | undefined;
}

export class AtemAdapterClient {
  private readonly piswitchUrl: string;
  private readonly templateStore: TemplateStore;
  private readonly activeStore: ActiveGraphicsStore;
  private readonly eventBroker: GraphicsEventBroker;
  private readonly fetchFn: typeof fetch;
  private readonly logger?: PiswitchClientOptions["logger"] | undefined;

  // Dedicated graphics pool in piswitch is slots 7..24
  private readonly graphicsPoolStart = 7;
  private readonly graphicsPoolEnd = 24;
  private currentSlotIndex = 7;

  constructor(options: PiswitchClientOptions) {
    this.piswitchUrl = options.piswitchUrl.replace(/\/+$/, "");
    this.templateStore = options.templateStore;
    this.activeStore = options.activeStore;
    this.eventBroker = options.eventBroker;
    this.fetchFn = options.fetchFn ?? fetch;
    this.logger = options.logger;
  }

  allocateNextSlot(): number {
    const slot = this.currentSlotIndex;
    this.currentSlotIndex++;
    if (this.currentSlotIndex > this.graphicsPoolEnd) {
      this.currentSlotIndex = this.graphicsPoolStart;
    }
    return slot;
  }

  async uploadStillToSlot(slot: number, rgbaBuffer: Buffer, name: string): Promise<boolean> {
    try {
      const url = `${this.piswitchUrl}/api/v1/video-mixer/media-pool/slots/${slot}?name=${encodeURIComponent(name)}&pool=graphics`;
      const res = await this.fetchFn(url, {
        method: "PUT",
        headers: {
          "Content-Type": "application/octet-stream",
        },
        body: rgbaBuffer,
      });

      if (!res.ok) {
        // Fallback to legacy endpoint /media/stills/:slot
        const fallbackUrl = `${this.piswitchUrl}/api/v1/video-mixer/media/stills/${slot}?name=${encodeURIComponent(name)}`;
        const fallbackRes = await this.fetchFn(fallbackUrl, {
          method: "PUT",
          headers: { "Content-Type": "application/octet-stream" },
          body: rgbaBuffer,
        });
        return fallbackRes.ok;
      }
      return true;
    } catch (err) {
      this.logger?.warn?.(`Failed to upload still to piswitch: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }

  async setMediaPlayerSource(player: number, slot: number): Promise<boolean> {
    try {
      const url = `${this.piswitchUrl}/api/v1/video-mixer/media-pool/players/${player}/source`;
      const res = await this.fetchFn(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stillSlot: slot }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async setDskOnAir(dsk = 1, onAir = true): Promise<boolean> {
    try {
      const url = `${this.piswitchUrl}/api/v1/video-mixer/dsk/${dsk}/on-air`;
      const res = await this.fetchFn(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onAir }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async setDskTie(dsk = 1, tie = true): Promise<boolean> {
    try {
      const url = `${this.piswitchUrl}/api/v1/video-mixer/dsk/${dsk}/tie`;
      const res = await this.fetchFn(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tie }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async triggerAutoTransition(): Promise<boolean> {
    try {
      const url = `${this.piswitchUrl}/api/v1/video-mixer/auto`;
      const res = await this.fetchFn(url, { method: "POST" });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * High-level action: Renders a template to RGBA still, uploads to piswitch graphics pool,
   * routes ATEM media player, and triggers DSK on-air or transition.
   */
  async pushTemplateToAtem(
    templateId: string,
    options: AtemPushOptions = {}
  ): Promise<{ ok: boolean; slot: number; mediaPlayer: number; dsk: number }> {
    const template = this.templateStore.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const slot = options.slot ?? this.allocateNextSlot();
    const mediaPlayer = options.mediaPlayer ?? 1;
    const dsk = options.dsk ?? 1;
    const autoOnAir = options.autoOnAir !== false;

    // Render still with current global bindings
    const bindings = this.activeStore.getBindings();
    let stillBuffer: Buffer;
    try {
      stillBuffer = await renderTemplateToRgbaStill(template, { bindings });
    } catch {
      stillBuffer = createSyntheticRgbaStill(template.width, template.height);
    }

    const uploaded = await this.uploadStillToSlot(slot, stillBuffer, template.name || template.id);
    if (!uploaded) {
      this.logger?.warn?.(`Upload still to slot ${slot} failed on piswitch (proceeding in simulated mode)`);
    }

    // Set media player to point to this slot
    await this.setMediaPlayerSource(mediaPlayer, slot);

    // Apply transition or keyer on-air
    if (options.transition === "tie") {
      await this.setDskTie(dsk, true);
    } else if (options.transition === "auto") {
      await this.setDskTie(dsk, true);
      await this.triggerAutoTransition();
    } else if (autoOnAir) {
      await this.setDskOnAir(dsk, true);
    }

    this.eventBroker.emit("graphics.atem_pushed", {
      templateId,
      slot,
      mediaPlayer,
      dsk,
      autoOnAir,
    });

    return { ok: true, slot, mediaPlayer, dsk };
  }
}
