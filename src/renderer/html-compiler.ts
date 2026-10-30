import type { ActiveGraphicInstance, GraphicLayer, GraphicTemplate } from "../types/index.js";
import { BROADCAST_CSS_ANIMATIONS, getAnimationCss } from "./animations.js";

function escapeHtml(str: string | undefined | null): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export interface HtmlCompileOptions {
  width?: number | undefined;
  height?: number | undefined;
  background?: string | undefined; // "transparent", "#00B140" (chroma), "#000000" (luma)
  serverUrl?: string | undefined;
  bindings?: Record<string, string> | undefined;
  includeSseClient?: boolean | undefined;
}

export function renderLayerToHtml(
  layer: GraphicLayer,
  bindings: Record<string, string> = {}
): string {
  if (layer.visible === false) return "";

  const idAttr = layer.id ? ` id="${escapeHtml(layer.id)}"` : "";
  const bindingKey = layer.binding;
  const bindingAttr = bindingKey ? ` data-binding="${escapeHtml(bindingKey)}"` : "";

  const anim = layer.animation;
  const entranceAnim = anim?.entrance
    ? getAnimationCss(anim.entrance, anim.entranceDurationMs ?? 500, anim.entranceDelayMs ?? 0, anim.easing)
    : "";
  const loopAnim = anim?.loop
    ? `${anim.loop} ${anim.loopDurationMs ?? 2000}ms ease-in-out infinite`
    : "";
  const combinedAnim = [entranceAnim, loopAnim].filter(Boolean).join(", ");

  const baseStyle: Record<string, string> = {
    position: "absolute",
    left: `${Number(layer.x) || 0}px`,
    top: `${Number(layer.y) || 0}px`,
  };

  if (layer.width != null) baseStyle.width = `${Number(layer.width)}px`;
  if (layer.height != null) baseStyle.height = `${Number(layer.height)}px`;
  if (layer.opacity != null) baseStyle.opacity = String(layer.opacity);
  if (layer.zIndex != null) baseStyle["z-index"] = String(layer.zIndex);
  if (layer.rotation != null) {
    baseStyle.transform = `rotate(${Number(layer.rotation)}deg)`;
    baseStyle["transform-origin"] = "center center";
  }
  if (combinedAnim) {
    baseStyle.animation = combinedAnim;
  }

  // Merge custom styles
  if (layer.style) {
    for (const [k, v] of Object.entries(layer.style)) {
      if (/^[a-zA-Z-]+$/.test(k) && v !== undefined) {
        baseStyle[k] = String(v);
      }
    }
  }

  const styleString = Object.entries(baseStyle)
    .map(([k, v]) => `${k}:${v}`)
    .join(";");

  // Determine text content
  const displayText = bindingKey && bindings[bindingKey] !== undefined
    ? bindings[bindingKey]
    : layer.text ?? "";

  if (layer.type === "text") {
    return `<div${idAttr}${bindingAttr} class="layer-item layer-text" style="${escapeHtml(styleString)}">${escapeHtml(displayText)}</div>`;
  }

  if (layer.type === "rect") {
    return `<div${idAttr}${bindingAttr} class="layer-item layer-rect" style="${escapeHtml(styleString)}"></div>`;
  }

  if (layer.type === "ellipse") {
    return `<div${idAttr}${bindingAttr} class="layer-item layer-ellipse" style="${escapeHtml(styleString)};border-radius:50%"></div>`;
  }

  if (layer.type === "image") {
    const src = escapeHtml(layer.src || "");
    return `<img${idAttr}${bindingAttr} class="layer-item layer-image" src="${src}" style="${escapeHtml(styleString)}" alt="">`;
  }

  if (layer.type === "clock") {
    return `<div${idAttr}${bindingAttr} class="layer-item layer-clock" data-clock="true" style="${escapeHtml(styleString)}">${escapeHtml(displayText || "00:00:00")}</div>`;
  }

  return `<div${idAttr}${bindingAttr} class="layer-item" style="${escapeHtml(styleString)}">${escapeHtml(displayText)}</div>`;
}

export function compileTemplateToHtml(
  template: GraphicTemplate,
  options: HtmlCompileOptions = {}
): string {
  const width = options.width ?? template.width ?? 1920;
  const height = options.height ?? template.height ?? 1080;
  const bg = options.background ?? template.background ?? "transparent";
  const bindings = options.bindings ?? {};

  const layersHtml = (template.layers || [])
    .map((l) => renderLayerToHtml(l, bindings))
    .join("\n      ");

  const sseScript = options.includeSseClient !== false && options.serverUrl
    ? buildSseClientScript(options.serverUrl)
    : "";

  return `<!DOCTYPE html>
<html lang="fi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=${width}, height=${height}, initial-scale=1.0">
  <title>${escapeHtml(template.name)} - PiGraphics</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
      background: ${bg};
      user-select: none;
      -webkit-user-select: none;
    }
    #viewport {
      position: relative;
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
    }
    ${BROADCAST_CSS_ANIMATIONS}
  </style>
</head>
<body>
  <div id="viewport">
    <div id="graphic-${escapeHtml(template.id)}" class="graphic-container">
      ${layersHtml}
    </div>
  </div>
  ${sseScript}
</body>
</html>`;
}

export function compileMultiGraphicsToHtml(
  activeInstances: Array<{ instance: ActiveGraphicInstance; template: GraphicTemplate }>,
  options: HtmlCompileOptions = {}
): string {
  const width = options.width ?? 1920;
  const height = options.height ?? 1080;
  const bg = options.background ?? "transparent";
  const bindings = options.bindings ?? {};

  const graphicsHtml = activeInstances
    .map(({ instance, template }) => {
      const instBindings = { ...bindings, ...(instance.bindings || {}) };
      const layers = (template.layers || []).map((l) => {
        const override = instance.layerOverrides?.[l.id];
        return override ? { ...l, ...override } : l;
      });
      const layersHtml = layers
        .map((l) => renderLayerToHtml(l, instBindings))
        .join("\n        ");

      return `<div id="${escapeHtml(instance.instanceId)}" class="graphic-container active" data-template="${escapeHtml(template.id)}">
        ${layersHtml}
      </div>`;
    })
    .join("\n\n    ");

  const sseScript = options.includeSseClient !== false && options.serverUrl
    ? buildSseClientScript(options.serverUrl)
    : "";

  return `<!DOCTYPE html>
<html lang="fi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=${width}, height=${height}, initial-scale=1.0">
  <title>PiGraphics Live Broadcast Display</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
      background: ${bg};
      user-select: none;
      -webkit-user-select: none;
    }
    #viewport {
      position: relative;
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
    }
    .graphic-container {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }
    ${BROADCAST_CSS_ANIMATIONS}
  </style>
</head>
<body>
  <div id="viewport">
    ${graphicsHtml}
  </div>
  ${sseScript}
</body>
</html>`;
}

function buildSseClientScript(serverUrl: string): string {
  const url = `${serverUrl}/api/v1/graphics/events`;
  return `
  <script>
  (function() {
    var sseUrl = ${JSON.stringify(url)};
    var retryDelay = 1000;

    function updateBindings(bindings) {
      if (!bindings || typeof bindings !== 'object') return;
      for (var key in bindings) {
        var elements = document.querySelectorAll('[data-binding="' + key + '"]');
        for (var i = 0; i < elements.length; i++) {
          elements[i].textContent = bindings[key];
        }
      }
    }

    function initClocks() {
      var clockEls = document.querySelectorAll('[data-clock="true"]');
      if (!clockEls.length) return;
      setInterval(function() {
        var now = new Date();
        var timeStr = now.toTimeString().split(' ')[0];
        for (var i = 0; i < clockEls.length; i++) {
          clockEls[i].textContent = timeStr;
        }
      }, 1000);
    }
    initClocks();

    function connect() {
      try {
        var es = new EventSource(sseUrl);

        es.onmessage = function(event) {
          try {
            var payload = JSON.parse(event.data);
            if (payload.type === 'graphics.bindings_updated') {
              updateBindings(payload.data && payload.data.bindings);
            } else if (payload.type === 'graphics.active_changed') {
              // Reload page or dynamically update active graphics
              window.location.reload();
            }
          } catch(e) {}
        };

        es.addEventListener('graphics.bindings_updated', function(event) {
          try {
            var payload = JSON.parse(event.data);
            updateBindings(payload.data && payload.data.bindings);
          } catch(e) {}
        });

        es.addEventListener('graphics.active_changed', function() {
          window.location.reload();
        });

        es.onerror = function() {
          es.close();
          setTimeout(connect, retryDelay);
          retryDelay = Math.min(retryDelay * 2, 10000);
        };

        es.onopen = function() {
          retryDelay = 1000;
        };
      } catch(e) {
        setTimeout(connect, retryDelay);
      }
    }
    connect();
  })();
  </script>
`;
}
