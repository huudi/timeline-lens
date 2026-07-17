// Best-effort attribution of a WAAPI Animation to the Motion library
// (motion.dev). There's no data-level marker for this: Motion's WAAPI path
// (NativeAnimation/startWaapiAnimation in motion-dom) is a bare
// `element.animate(keyframes, options)` call, indistinguishable from a
// hand-written one once it's returned (confirmed by reading Motion's own
// source). The only thing that *does* differ is where the call came from,
// so this captures the call-site stack the moment `.animate()` fires (a
// behavior-neutral passthrough wrap: nothing about timing or the returned
// Animation changes) and classifies engine by matching that stack's
// originating script path against a "this looks like Motion" signature.
//
// Known limitation, not fixed here: activation is a dev-only dynamic
// `import('timeline-lens')`, which runs after the host page's own
// top-level script code, so this wrap installs too late to catch
// page-load-time `.animate()` calls, those fall back to the generic
// 'waapi' classification. Runtime-triggered calls (click/hover/etc,
// anything after mount) are captured correctly. Same flavour of honesty as
// detect.js's gsap.globalTimeline auto-removal: nothing here retroactively
// knows how an animation already in flight was authored.
//
// Motion also has a main-thread JSAnimation path that never calls
// Element.animate() at all, so it never produces a native Animation object,
// it's invisible to document.getAnimations() regardless of this module.
// Which path a call takes isn't just "spring vs duration": Motion's own
// source (accelerated-values.ts) only ever hands opacity, filter, clipPath,
// or the literal `transform` property to a real element.animate() call —
// its x/y/scale/rotate/etc. shorthands are composed into a transform string
// on the main thread and never touch WAAPI at all, confirmed empirically.
// Only calls animating one of those four properties are attributable here.

const callSites = new WeakMap(); // Animation -> captured stack (string)
let wrapped = false;

// Matches a stack frame whose script filename signals "this call originated
// from the Motion library" — "motion" as a substring of the last path
// segment, ending in .js/.mjs. Deliberately lenient about what comes before/
// after "motion" in the filename: real bundler output varies a lot more
// than a fixed list of exact names would cover, e.g. Vite's dev-server
// pre-bundling flattens `motion/react` to `motion_react.js` (confirmed by
// inspecting actual network requests against apps/react-test-site, not
// guessed), a production build might content-hash it to `motion.a1b2c3.js`,
// and a CDN build is typically `motion.js`/`motion.min.js`. A node_modules-
// relative path (`node_modules/motion/...`, source maps, Node resolution)
// also always matches, since "motion" appears in that path too.
const MOTION_PATH_RE = /\/[\w.-]*motion[\w.-]*\.m?js\b/i;

function classifyStack(stack) {
  if (!stack) return null;
  // First line is just "Error" (or the message); frames start after that,
  // and the immediate next frame is this module's own wrapper, skip it.
  const lines = stack.split('\n').slice(2);
  for (const line of lines) {
    if (MOTION_PATH_RE.test(line)) return 'motion';
    // Stop at the first frame that isn't part of the wrap machinery itself;
    // one real caller frame is enough to decide, walking further back risks
    // matching an unrelated intermediate frame (e.g. a framework's own
    // event-dispatch internals) rather than the actual call site.
    break;
  }
  return null;
}

// Wraps Element.prototype.animate exactly once, passthrough (calls the
// native implementation immediately, synchronously, with the same
// arguments and return value), purely to observe where each call came
// from. Safe to call more than once; only the first call actually wraps.
export function ensureMotionAttribution() {
  if (wrapped || typeof Element === 'undefined' || !Element.prototype.animate) return;
  wrapped = true;
  const native = Element.prototype.animate;
  Element.prototype.animate = function (...args) {
    const anim = native.apply(this, args);
    try {
      callSites.set(anim, new Error().stack);
    } catch {}
    return anim;
  };
}

// Read-only: 'motion' when this Animation's captured call-site matches a
// Motion signature, otherwise null (caller falls back to plain 'waapi').
export function classifyCallSite(anim) {
  return classifyStack(callSites.get(anim));
}

// A single V8-style stack frame line, either "at fn (url:line:col)" or the
// bare "at url:line:col" form (anonymous/top-level calls).
const FRAME_RE = /at\s+(?:.*?\s+\()?([^()\s]+):(\d+):(\d+)\)?\s*$/;

// Read-only: {url, line} for this Animation's real call site (skipping this
// module's own wrapper frame), if a stack was captured at all. Used by the
// Code panel to show an exact, non-guessed location for a Motion/WAAPI leaf
// instead of falling back to source.js's regex-based best guess.
export function callSiteFor(anim) {
  const stack = callSites.get(anim);
  if (!stack) return null;
  const lines = stack.split('\n').slice(2); // skip "Error" + this module's own frame
  const m = FRAME_RE.exec(lines[0] || '');
  if (!m) return null;
  return { url: m[1], line: Number(m[2]) };
}
