/**
 * Broadcast CSS animation keyframes and helpers.
 */

export const BROADCAST_CSS_ANIMATIONS = `
/* Smooth broadcast easing curve (out-expo) */
:root {
  --broadcast-ease: cubic-bezier(0.16, 1, 0.3, 1);
  --broadcast-ease-in: cubic-bezier(0.7, 0, 0.84, 0);
}

/* Fades */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes fadeOut {
  from { opacity: 1; }
  to { opacity: 0; }
}

/* Slides */
@keyframes slideInLeft {
  from { transform: translateX(-120%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

@keyframes slideOutLeft {
  from { transform: translateX(0); opacity: 1; }
  to { transform: translateX(-120%); opacity: 0; }
}

@keyframes slideInRight {
  from { transform: translateX(120%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

@keyframes slideOutRight {
  from { transform: translateX(0); opacity: 1; }
  to { transform: translateX(120%); opacity: 0; }
}

@keyframes slideInUp {
  from { transform: translateY(120%); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

@keyframes slideOutDown {
  from { transform: translateY(0); opacity: 1; }
  to { transform: translateY(120%); opacity: 0; }
}

@keyframes slideInDown {
  from { transform: translateY(-120%); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

@keyframes slideOutUp {
  from { transform: translateY(0); opacity: 1; }
  to { transform: translateY(-120%); opacity: 0; }
}

/* Zooms */
@keyframes zoomIn {
  from { transform: scale(0.7); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

@keyframes zoomOut {
  from { transform: scale(1); opacity: 1; }
  to { transform: scale(0.7); opacity: 0; }
}

/* Pulsing & Blinking */
@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.04); }
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.2; }
}

/* Lower third combined strap wipe */
@keyframes lowerThirdStrap {
  0% {
    clip-path: polygon(0 0, 0 0, 0 100%, 0 100%);
    opacity: 0;
  }
  100% {
    clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%);
    opacity: 1;
  }
}

/* Typewriter text reveal */
@keyframes typewriter {
  from { clip-path: inset(0 100% 0 0); }
  to { clip-path: inset(0 0 0 0); }
}
`;

export function getAnimationCss(
  animationName: string | undefined,
  durationMs = 500,
  delayMs = 0,
  easing = "var(--broadcast-ease)"
): string {
  if (!animationName || animationName === "none") return "";
  const delayStr = delayMs > 0 ? ` ${delayMs}ms` : "";
  return `${animationName} ${durationMs}ms ${easing}${delayStr} both`;
}
