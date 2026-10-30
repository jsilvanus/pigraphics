import { EventEmitter } from "node:events";
import type { GraphicsEvent, GraphicsEventType } from "./types/index.js";

export class GraphicsEventBroker {
  private readonly emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(100);
  }

  emit<T>(type: GraphicsEventType, data: T): void {
    const event: GraphicsEvent<T> = {
      type,
      data,
      timestamp: new Date().toISOString(),
    };
    this.emitter.emit("event", event);
    this.emitter.emit(type, event);
  }

  subscribe(listener: (event: GraphicsEvent) => void): () => void {
    this.emitter.on("event", listener);
    return () => {
      this.emitter.off("event", listener);
    };
  }

  onType<T>(type: GraphicsEventType, listener: (event: GraphicsEvent<T>) => void): () => void {
    const wrapper = (e: unknown) => listener(e as GraphicsEvent<T>);
    this.emitter.on(type, wrapper);
    return () => {
      this.emitter.off(type, wrapper);
    };
  }

  listenerCount(): number {
    return this.emitter.listenerCount("event");
  }
}
