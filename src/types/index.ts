/**
 * Core type definitions for pigraphics.
 */

export type LayerType = "text" | "rect" | "ellipse" | "image" | "clock" | "lower-third" | "scripture";

export type AnimationType =
  | "none"
  | "fadeIn"
  | "fadeOut"
  | "slideInLeft"
  | "slideInRight"
  | "slideInUp"
  | "slideInDown"
  | "slideOutLeft"
  | "slideOutRight"
  | "slideOutUp"
  | "slideOutDown"
  | "zoomIn"
  | "zoomOut"
  | "pulse"
  | "blink"
  | "typewriter"
  | "lowerThirdStrap";

export interface LayerAnimation {
  entrance?: AnimationType | string | undefined;
  entranceDurationMs?: number | undefined;
  entranceDelayMs?: number | undefined;
  exit?: AnimationType | string | undefined;
  exitDurationMs?: number | undefined;
  loop?: AnimationType | string | undefined;
  loopDurationMs?: number | undefined;
  easing?: string | undefined;
}

export interface GraphicLayer {
  id: string;
  type: LayerType;
  x: number;
  y: number;
  width?: number | undefined;
  height?: number | undefined;
  rotation?: number | undefined;
  opacity?: number | undefined;
  zIndex?: number | undefined;
  text?: string | undefined;
  /** SSE binding key, e.g. "speaker", "title", "scripture", "stanza" */
  binding?: string | undefined;
  src?: string | undefined;
  style?: Record<string, string | number> | undefined;
  animation?: LayerAnimation | undefined;
  visible?: boolean | undefined;
}

export interface GraphicTemplate {
  id: string;
  name: string;
  description?: string | undefined;
  width: number;
  height: number;
  background?: string | undefined;
  layers: GraphicLayer[];
  tags?: string[] | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface ActiveGraphicInstance {
  instanceId: string;
  templateId: string;
  layerOverrides?: Record<string, Partial<GraphicLayer>> | undefined;
  bindings?: Record<string, string> | undefined;
  active: boolean;
  shownAt?: string | undefined;
  autoHideMs?: number | undefined;
}

export type StreamOutputMode = "single-chroma" | "single-luma" | "dual-fill-key";

export interface StreamOutputs {
  singleUrl?: string | undefined;
  fillUrl?: string | undefined;
  keyUrl?: string | undefined;
}

export interface StreamJobConfig {
  mode: StreamOutputMode;
  width?: number | undefined;
  height?: number | undefined;
  fps?: number | undefined;
  keyColor?: string | undefined; // e.g. #00B140 (chroma green) or #000000 (luma black)
  outputs: StreamOutputs;
}

export interface StreamJobStatus {
  running: boolean;
  mode: StreamOutputMode;
  jobId?: string | undefined;
  executor: "fleet" | "local";
  outputs: StreamOutputs;
  startedAt?: string | undefined;
  error?: string | undefined;
}

export interface AtemPushOptions {
  slot?: number | undefined; // Graphics pool slot 7..24
  mediaPlayer?: number | undefined; // 1 or 2
  dsk?: number | undefined; // 1..4
  usk?: number | undefined; // 1..4
  keyer?: "usk" | "dsk" | undefined;
  movement?: GraphicMovement | undefined;
  autoHideMs?: number | undefined;
  autoOnAir?: boolean | undefined;
  transition?: "cut" | "auto" | "tie" | undefined;
}

export type GraphicMovement =
  | "cut"
  | "dissolve"
  | "fly-left"
  | "fly-right"
  | "fly-bottom"
  | "fly-top"
  | "zoom";

export interface CanvaGraphicPushOptions {
  title?: string | undefined;
  image?: string | undefined; // base64 or data URL
  imageUrl?: string | undefined; // external or internal URL
  movement?: GraphicMovement | undefined;
  autoHideMs?: number | undefined;
  slot?: number | undefined;
  mediaPlayer?: number | undefined;
  keyer?: "usk" | "dsk" | undefined;
  usk?: number | undefined;
}

export interface CanvaGraphicPushResult {
  ok: boolean;
  title: string;
  slot: number;
  mediaPlayer: number;
  movement: GraphicMovement;
  keyer: "usk" | "dsk";
  autoHideMs?: number | undefined;
}

export interface GatewayActionPayload {
  actor: string;
  action: string;
  params: Record<string, unknown>;
  ok?: boolean | undefined;
  timestamp?: string | undefined;
}

export interface GatewayTranscriptPayload {
  session_id: string;
  events: Array<{
    seq: number;
    text: string;
    speaker?: string | undefined;
    is_final?: boolean | undefined;
  }>;
}

export type GraphicsEventType =
  | "graphics.active_changed"
  | "graphics.bindings_updated"
  | "graphics.stream_status"
  | "graphics.atem_pushed"
  | "graphics.canva_pushed"
  | "graphics.template_saved";

export interface GraphicsEvent<T = unknown> {
  type: GraphicsEventType;
  data: T;
  timestamp: string;
}
