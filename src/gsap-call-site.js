// Best-effort attribution of a GSAP tween/timeline back to the *exact*
// source line that created it — the GSAP mirror of motion-ref.js's
// Element.prototype.animate wrap, applied to gsap.timeline/to/from/fromTo
// instead.
//
// Why this exists: detect.js's positional/unlabeledIndex fallback (see its
// own header comment, and source.js's `positional` array) has to guess an
// unlabeled top-level call's identity from a live-discovery-order counter,
// matched index-for-index against a *static* file-position-sorted list.
// That guess only holds up when every unlabeled animation is (a) created in
// the same relative order it's written in the file, and (b) still alive on
// gsap.globalTimeline the moment this module's first scan runs. Neither is
// guaranteed: a scroll-deferred reveal (ScrollTrigger.batch's onEnter), a
// click handler, or a carousel rebuilding the same timeline per slide can
// easily fire out of file order relative to some other unlabeled call
// elsewhere on the page — and a short page-load intro can finish and be
// auto-removed (gsap.globalTimeline's autoRemoveChildren) before this
// dev-only panel ever mounts to look, silently reassigning its ordinal slot
// to whatever unrelated animation happens to still be alive when scanning
// starts (see detect.js's own comment on that gap).
//
// Wrapping the four factory functions the moment `gsap` resolves captures
// the exact call site for anything created from then on — no ordering
// assumption, no guess — leaving the positional fallback to cover only
// what it structurally can't: animations already running (or already gone)
// before this module ever loaded. Same accepted limitation as
// ensureMotionAttribution, not something installing any earlier can fix
// (activation is a dev-only dynamic `import('timeline-lens')`, which
// necessarily runs after the host page's own top-level script code).

const callSites = new WeakMap(); // gsap instance -> captured stack (string)
let wrappedGsap = null; // the gsap instance currently wrapped, or null

const FACTORY_METHODS = ['timeline', 'to', 'from', 'fromTo'];

function wrapFactory(gsap, name) {
  const native = gsap[name];
  if (typeof native !== 'function' || native.__gtsCallSiteWrapped) return;
  function wrapped(...args) {
    const inst = native.apply(this, args);
    if (inst) {
      try {
        callSites.set(inst, new Error().stack);
      } catch {}
    }
    return inst;
  }
  wrapped.__gtsCallSiteWrapped = true;
  gsap[name] = wrapped;
}

// Wraps gsap.timeline/to/from/fromTo exactly once per gsap instance. Safe to
// call more than once — e.g. across a destroy()/init() toggle cycle — since
// wrapFactory no-ops on an already-wrapped method and this no-ops entirely
// once the same `gsap` has already been wrapped.
export function ensureGsapCallSites(gsap) {
  if (!gsap || wrappedGsap === gsap) return;
  wrappedGsap = gsap;
  for (const name of FACTORY_METHODS) wrapFactory(gsap, name);
}

// A single V8-style stack frame line, either "at fn (url:line:col)" or the
// bare "at url:line:col" form (anonymous/top-level calls) — same pattern as
// motion-ref.js's FRAME_RE.
const FRAME_RE = /at\s+(?:.*?\s+\()?([^()\s]+):(\d+):(\d+)\)?\s*$/;

// Read-only: {url, line} for this instance's real call site, or null when
// it was created before the wrap installed (see the header comment above).
export function callSiteFor(anim) {
  const stack = callSites.get(anim);
  if (!stack) return null;
  const lines = stack.split('\n').slice(2); // skip "Error" + this module's own wrapper frame
  const m = FRAME_RE.exec(lines[0] || '');
  if (!m) return null;
  return { url: m[1], line: Number(m[2]) };
}
