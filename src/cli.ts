#!/usr/bin/env node

const BASE_URL = (process.env.PIGRAPHICS_URL || "http://127.0.0.1:3107").replace(/\/+$/, "");

async function fetchJson(path: string, options: RequestInit = {}): Promise<any> {
  const url = `${BASE_URL}${path}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`Error (${res.status}): ${text}`);
      process.exit(1);
    }
    return await res.json();
  } catch (err) {
    console.error(`Connection failed to ${url}: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

function parseFlags(args: string[]): { positional: string[]; flags: Record<string, string | boolean> } {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg && arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else if (arg) {
      positional.push(arg);
    }
  }

  return { positional, flags };
}

async function runCli() {
  const rawArgs = process.argv.slice(2);
  const { positional, flags } = parseFlags(rawArgs);
  const cmd = positional[0] || "help";

  switch (cmd) {
    case "status": {
      const data = await fetchJson("/api/v1/status");
      console.log("\n--- PiGraphics Service Status ---");
      console.log(`Service:           ${data.service}`);
      console.log(`Version:           ${data.version}`);
      console.log(`Port:              ${data.port}`);
      console.log(`Templates count:   ${data.templatesCount}`);
      console.log(`Active graphics:   ${data.activeCount}`);
      console.log(`Gateway connected: ${data.gatewayConnected}`);
      console.log(`Live stream:       ${data.stream.running ? `ACTIVE (${data.stream.mode} via ${data.stream.executor})` : "INACTIVE"}`);
      console.log("---------------------------------\n");
      break;
    }

    case "templates": {
      const sub = positional[1] || "list";
      if (sub === "list") {
        const templates = await fetchJson("/api/v1/graphics/templates");
        console.table(
          templates.map((t: any) => ({
            ID: t.id,
            Name: t.name,
            Dimensions: `${t.width}x${t.height}`,
            Layers: t.layers?.length ?? 0,
            Tags: (t.tags || []).join(", "),
          }))
        );
      }
      break;
    }

    case "active": {
      const active = await fetchJson("/api/v1/graphics/active");
      if (active.length === 0) {
        console.log("No graphics currently active on air.");
      } else {
        console.table(
          active.map((a: any) => ({
            InstanceID: a.instanceId,
            TemplateID: a.templateId,
            Active: a.active,
            ShownAt: a.shownAt,
            AutoHideMs: a.autoHideMs ?? "-",
          }))
        );
      }
      break;
    }

    case "show": {
      const templateId = positional[1];
      if (!templateId) {
        console.error("Usage: pigraphics show <templateId> [--speaker 'Name'] [--title 'Title'] [--auto-hide 7000]");
        process.exit(1);
      }
      const bindings: Record<string, string> = {};
      if (typeof flags.speaker === "string") bindings.speaker = flags.speaker;
      if (typeof flags.title === "string") bindings.title = flags.title;
      if (typeof flags.citation === "string") bindings.citation = flags.citation;
      if (typeof flags.passage === "string") bindings.passage = flags.passage;
      if (typeof flags.hymn === "string") bindings.hymn_number = flags.hymn;

      const autoHideMs = flags["auto-hide"] ? Number(flags["auto-hide"]) : undefined;

      const res = await fetchJson("/api/v1/graphics/active/show", {
        method: "POST",
        body: JSON.stringify({
          templateId,
          bindings: Object.keys(bindings).length > 0 ? bindings : undefined,
          autoHideMs,
        }),
      });
      console.log(`[OK] Shown graphic instance: ${res.instanceId} (${res.templateId})`);
      break;
    }

    case "hide": {
      const instanceId = positional[1];
      if (!instanceId) {
        console.error("Usage: pigraphics hide <instanceId>");
        process.exit(1);
      }
      await fetchJson(`/api/v1/graphics/active/hide/${encodeURIComponent(instanceId)}`, {
        method: "POST",
      });
      console.log(`[OK] Hidden graphic instance: ${instanceId}`);
      break;
    }

    case "clear": {
      await fetchJson("/api/v1/graphics/active/clear", { method: "POST" });
      console.log("[OK] Cleared all active graphics.");
      break;
    }

    case "atem": {
      const action = positional[1];
      if (action === "push") {
        const templateId = positional[2];
        if (!templateId) {
          console.error("Usage: pigraphics atem push <templateId> [--slot 7] [--dsk 1] [--player 1] [--no-air]");
          process.exit(1);
        }
        const slot = flags.slot ? Number(flags.slot) : undefined;
        const dsk = flags.dsk ? Number(flags.dsk) : undefined;
        const mediaPlayer = flags.player ? Number(flags.player) : undefined;
        const autoOnAir = flags["no-air"] ? false : true;

        const res = await fetchJson("/api/v1/graphics/atem/push", {
          method: "POST",
          body: JSON.stringify({ templateId, slot, dsk, mediaPlayer, autoOnAir }),
        });
        console.log(`[OK] Pushed template to ATEM still slot ${res.slot}, Media Player ${res.mediaPlayer}, DSK ${res.dsk}`);
      } else if (action === "on-air" || action === "off-air") {
        const dsk = positional[2] ? Number(positional[2]) : 1;
        const onAir = action === "on-air";
        await fetchJson("/api/v1/graphics/atem/dsk/on-air", {
          method: "POST",
          body: JSON.stringify({ dsk, onAir }),
        });
        console.log(`[OK] Set DSK ${dsk} on-air: ${onAir}`);
      }
      break;
    }

    case "stream": {
      const action = positional[1];
      if (action === "start") {
        const mode = (typeof flags.mode === "string" ? flags.mode : "single-chroma") as any;
        const res = await fetchJson("/api/v1/graphics/stream/start", {
          method: "POST",
          body: JSON.stringify({ mode, outputs: {} }),
        });
        console.log(`[OK] Stream started (${res.mode} via ${res.executor})`);
      } else if (action === "stop") {
        await fetchJson("/api/v1/graphics/stream/stop", { method: "POST" });
        console.log("[OK] Stream stopped.");
      } else {
        const status = await fetchJson("/api/v1/graphics/stream/status");
        console.log(status);
      }
      break;
    }

    case "help":
    default: {
      console.log(`
PiGraphics CLI

Usage:
  pigraphics status                                   Show service status
  pigraphics templates list                           List all templates
  pigraphics active list                              List active graphics on air
  pigraphics show <id> [--speaker S] [--title T]      Show graphic with bindings
  pigraphics hide <instanceId>                        Hide active graphic
  pigraphics clear                                    Clear all graphics on air
  pigraphics atem push <id> [--slot N] [--dsk N]      Render & push still to ATEM
  pigraphics atem on-air [dsk]                        Set ATEM DSK on air
  pigraphics atem off-air [dsk]                       Set ATEM DSK off air
  pigraphics stream start [--mode dual-fill-key]      Start fffleet live stream
  pigraphics stream stop                              Stop live stream
`);
      break;
    }
  }
}

void runCli();
