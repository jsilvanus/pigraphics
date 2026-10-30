import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ActiveGraphicsStore } from "../src/store/active-graphics-store.js";
import { GraphicsEventBroker } from "../src/events.js";

describe("ActiveGraphicsStore", () => {
  it("supports concurrent multiple graphics on air and event dispatching", () => {
    const broker = new GraphicsEventBroker();
    const store = new ActiveGraphicsStore(broker);

    const events: string[] = [];
    broker.subscribe((e) => events.push(e.type));

    // Show lower third
    const inst1 = store.show("lower-third-speaker", {
      instanceId: "lt-1",
      bindings: { speaker: "Matti Meikäläinen", title: "Kanttori" },
    });

    // Show corner logo simultaneously
    const inst2 = store.show("corner-logo", {
      instanceId: "logo-1",
    });

    assert.equal(store.getActive().length, 2, "Both graphics should be active simultaneously");
    assert.equal(store.getInstance("lt-1")?.active, true);
    assert.equal(store.getInstance("logo-1")?.active, true);
    assert.equal(store.getBindings().speaker, "Matti Meikäläinen");

    // Hide one
    store.hide("lt-1");
    assert.equal(store.getActive().length, 1);
    assert.equal(store.getActive()[0]?.instanceId, "logo-1");

    // Clear all
    store.clear();
    assert.equal(store.getActive().length, 0);

    assert.ok(events.includes("graphics.active_changed"));
    assert.ok(events.includes("graphics.bindings_updated"));
  });
});
