/**
 * Mounts the studio: resolves gsap if available, injects the floating
 * trigger button, and renders the panel inside a Shadow DOM root.
 * A no-op if already mounted.
 */
export function init(): Promise<void>;

/**
 * Fully tears the studio down — stops detection/ticking, removes its
 * listeners, and unmounts the panel/trigger button. Safe to call even if
 * nothing is currently mounted.
 */
export function destroy(): void;

/**
 * Mounts if not currently mounted, tears down (destroy()) if it is.
 */
export function toggle(): Promise<void>;
