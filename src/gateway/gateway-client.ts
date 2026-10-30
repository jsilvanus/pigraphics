import type { ActiveGraphicsStore } from "../store/active-graphics-store.js";
import type { GraphicsEventBroker } from "../events.js";
import type { AtemAdapterClient } from "../switcher/piswitch-client.js";
import { formatSpeakerStrap, resolveSpeakerFromRundown } from "./speaker-resolver.js";

export interface GatewayClientOptions {
  gatewayUrl: string;
  activeStore: ActiveGraphicsStore;
  eventBroker: GraphicsEventBroker;
  atemClient?: AtemAdapterClient | undefined;
  fetchFn?: typeof fetch | undefined;
  logger?: { info: (...args: any[]) => void; warn: (...args: any[]) => void; error: (...args: any[]) => void } | undefined;
}

export class GatewayClient {
  private readonly gatewayUrl: string;
  private readonly activeStore: ActiveGraphicsStore;
  private readonly eventBroker: GraphicsEventBroker;
  private readonly atemClient?: AtemAdapterClient | undefined;
  private readonly fetchFn: typeof fetch;
  private readonly logger?: GatewayClientOptions["logger"] | undefined;

  private abortController: AbortController | null = null;
  private connected = false;

  constructor(options: GatewayClientOptions) {
    this.gatewayUrl = options.gatewayUrl.replace(/\/+$/, "");
    this.activeStore = options.activeStore;
    this.eventBroker = options.eventBroker;
    this.atemClient = options.atemClient;
    this.fetchFn = options.fetchFn ?? fetch;
    this.logger = options.logger;
  }

  isConnected(): boolean {
    return this.connected;
  }

  start(): void {
    if (this.abortController) return;
    this.abortController = new AbortController();
    void this.runLoop(this.abortController.signal);
  }

  stop(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.connected = false;
  }

  private async runLoop(signal: AbortSignal): Promise<void> {
    let backoffMs = 1000;

    while (!signal.aborted) {
      try {
        // We listen to action and rundown events.
        // Names are NEVER inferred from transcription events alone.
        const url = `${this.gatewayUrl}/api/v1/events?types=action,rundown`;
        this.logger?.info?.(`Connecting to Gateway SSE: ${url}`);

        const response = await this.fetchFn(url, {
          headers: { Accept: "text/event-stream" },
          signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`Gateway SSE returned HTTP ${response.status}`);
        }

        this.connected = true;
        backoffMs = 1000;
        this.logger?.info?.("Connected to Gateway SSE stream");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (!signal.aborted) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const blocks = buffer.split("\n\n");
          buffer = blocks.pop() ?? "";

          for (const block of blocks) {
            this.handleBlock(block);
          }
        }
        if (!signal.aborted) {
          await new Promise((res) => setTimeout(res, backoffMs));
        }
      } catch (err) {
        this.connected = false;
        if (signal.aborted) return;
        this.logger?.warn?.(
          `Gateway SSE disconnected (${err instanceof Error ? err.message : String(err)}). Reconnecting in ${backoffMs}ms...`
        );
        await new Promise((res) => setTimeout(res, backoffMs));
        backoffMs = Math.min(backoffMs * 2, 10000);
      }
    }
  }

  private handleBlock(block: string): void {
    const lines = block.split("\n");
    let eventType = "message";
    let dataStr = "";

    for (const line of lines) {
      if (line.startsWith("event:")) {
        eventType = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        dataStr += line.slice(5).trim();
      }
    }

    if (!dataStr) return;

    try {
      const payload = JSON.parse(dataStr) as { type?: string; data?: any };
      const type = payload.type || eventType;
      const eventData = payload.data !== undefined ? payload.data : payload;

      if (type === "action") {
        this.handleActionEvent(eventData);
      } else if (type === "rundown") {
        this.handleRundownEvent(eventData);
      }
    } catch {
      // ignore parse error
    }
  }

  private handleActionEvent(data: any): void {
    if (!data || typeof data.action !== "string") return;
    const action = data.action;
    const params = data.params || {};

    if (action === "graphic.show" && typeof params.templateId === "string") {
      this.activeStore.show(params.templateId, {
        instanceId: params.instanceId,
        layerOverrides: params.layerOverrides,
        bindings: params.bindings,
        autoHideMs: params.autoHideMs,
      });
    } else if (action === "graphic.hide" && typeof params.instanceId === "string") {
      this.activeStore.hide(params.instanceId);
    } else if (action === "graphic.bindings" && params.bindings && typeof params.bindings === "object") {
      this.activeStore.updateBindings(params.bindings);
    } else if (action === "lowerthird.set" || action === "speaker.set") {
      // Rule: If name is not present, ONLY role can be displayed!
      const strap = formatSpeakerStrap({
        role: params.role,
        name: params.name || params.speaker,
        title: params.title,
      });

      const bindings: Record<string, string> = {
        speaker: strap.speaker,
        title: strap.title,
        role: strap.role,
      };

      this.activeStore.updateBindings(bindings);
      if (params.show !== false) {
        this.activeStore.show("lower-third-speaker", {
          bindings,
          autoHideMs: params.autoHideMs ?? 7000,
        });
      }
    } else if (action === "graphic.atem_push" && typeof params.templateId === "string" && this.atemClient) {
      void this.atemClient.pushTemplateToAtem(params.templateId, {
        slot: params.slot,
        mediaPlayer: params.mediaPlayer,
        dsk: params.dsk,
        autoOnAir: params.autoOnAir !== false,
      });
    }
  }

  private handleRundownEvent(data: any): void {
    if (!data || typeof data !== "object") return;

    // RundownStatusSnapshot contains currentItem and variables
    const currentItem = data.currentItem || data.activeItem || null;
    const variables = (data.variables && typeof data.variables === "object") ? data.variables : {};

    const strap = resolveSpeakerFromRundown(currentItem, variables);
    if (!strap) return;

    // Update bindings strictly following: if name is absent, speaker = role!
    this.activeStore.updateBindings({
      speaker: strap.speaker,
      title: strap.title,
      role: strap.role,
    });

    // If rundown indicates lower-third should show on cue (e.g. cue_fired or action)
    if (data.showGraphic || variables.auto_show_strap === "true" || variables.auto_show_lowerthird === "true") {
      this.activeStore.show("lower-third-speaker", {
        bindings: {
          speaker: strap.speaker,
          title: strap.title,
          role: strap.role,
        },
        autoHideMs: 7000,
      });
    }
  }
}
