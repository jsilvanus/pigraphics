import type { ActiveGraphicInstance } from "../types/index.js";
import type { GraphicsEventBroker } from "../events.js";

export interface ShowGraphicOptions {
  instanceId?: string | undefined;
  layerOverrides?: Record<string, any> | undefined;
  bindings?: Record<string, string> | undefined;
  autoHideMs?: number | undefined;
}

export class ActiveGraphicsStore {
  private readonly instances = new Map<string, ActiveGraphicInstance>();
  private readonly globalBindings = new Map<string, string>();
  private readonly eventBroker: GraphicsEventBroker;
  private readonly autoHideTimers = new Map<string, NodeJS.Timeout>();

  constructor(eventBroker: GraphicsEventBroker) {
    this.eventBroker = eventBroker;
  }

  getAll(): ActiveGraphicInstance[] {
    return Array.from(this.instances.values());
  }

  getActive(): ActiveGraphicInstance[] {
    return Array.from(this.instances.values()).filter((inst) => inst.active);
  }

  getInstance(instanceId: string): ActiveGraphicInstance | undefined {
    return this.instances.get(instanceId);
  }

  getBindings(): Record<string, string> {
    const res: Record<string, string> = {};
    for (const [k, v] of this.globalBindings.entries()) {
      res[k] = v;
    }
    return res;
  }

  show(templateId: string, options?: ShowGraphicOptions): ActiveGraphicInstance {
    const instanceId = options?.instanceId || `inst-${templateId}-${Date.now()}`;

    // Clear any existing timer for this instance
    const existingTimer = this.autoHideTimers.get(instanceId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.autoHideTimers.delete(instanceId);
    }

    if (options?.bindings) {
      for (const [k, v] of Object.entries(options.bindings)) {
        this.globalBindings.set(k, String(v));
      }
    }

    const instance: ActiveGraphicInstance = {
      instanceId,
      templateId,
      active: true,
      shownAt: new Date().toISOString(),
      ...(options?.layerOverrides ? { layerOverrides: options.layerOverrides } : {}),
      ...(options?.bindings ? { bindings: options.bindings } : {}),
      ...(options?.autoHideMs ? { autoHideMs: options.autoHideMs } : {}),
    };

    this.instances.set(instanceId, instance);

    if (options?.autoHideMs && options.autoHideMs > 0) {
      const timer = setTimeout(() => {
        this.hide(instanceId);
      }, options.autoHideMs);
      this.autoHideTimers.set(instanceId, timer);
    }

    this.eventBroker.emit("graphics.active_changed", {
      action: "show",
      instance,
      allActive: this.getActive(),
    });

    if (options?.bindings) {
      this.eventBroker.emit("graphics.bindings_updated", {
        bindings: this.getBindings(),
      });
    }

    return instance;
  }

  hide(instanceId: string): boolean {
    const instance = this.instances.get(instanceId);
    if (!instance || !instance.active) return false;

    instance.active = false;
    const timer = this.autoHideTimers.get(instanceId);
    if (timer) {
      clearTimeout(timer);
      this.autoHideTimers.delete(instanceId);
    }

    this.eventBroker.emit("graphics.active_changed", {
      action: "hide",
      instanceId,
      allActive: this.getActive(),
    });

    // Clean up inactive instance after delay (allowing CSS exit animations)
    setTimeout(() => {
      if (this.instances.get(instanceId)?.active === false) {
        this.instances.delete(instanceId);
      }
    }, 1500);

    return true;
  }

  updateBindings(newBindings: Record<string, string>): void {
    for (const [k, v] of Object.entries(newBindings)) {
      this.globalBindings.set(k, String(v));
    }
    this.eventBroker.emit("graphics.bindings_updated", {
      bindings: this.getBindings(),
    });
  }

  clear(): void {
    for (const timer of this.autoHideTimers.values()) {
      clearTimeout(timer);
    }
    this.autoHideTimers.clear();
    this.instances.clear();

    this.eventBroker.emit("graphics.active_changed", {
      action: "clear",
      allActive: [],
    });
  }
}
