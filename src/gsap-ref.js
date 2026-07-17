// gsap is an OPTIONAL peer dependency: the studio also detects CSS
// animations/transitions and element.animate() calls (see detect-css.js) and
// must keep working on pages that never installed gsap at all. A static
// `import { gsap } from 'gsap'` would fail module resolution outright when
// gsap isn't present, so it's resolved once via a dynamic import that's
// allowed to fail instead.
//
// `gsap` is a live ES module binding, every importer re-reads it on each
// access rather than caching the value from its own import time, so once
// ensureGsap() resolves, every module that already did `import { gsap } from
// './gsap-ref.js'` sees the real module (or stays null) without needing to
// re-import anything.
export let gsap = null;

let pending = null;

// When gsap IS installed, this resolves to the exact same module instance
// the host page uses, which is what makes gsap.globalTimeline inspection
// possible at all. Safe to call more than once; only the first call
// actually attempts the import.
export function ensureGsap() {
  if (!pending) {
    pending = import('gsap')
      .then((mod) => {
        gsap = mod.gsap ?? mod.default ?? mod;
        return gsap;
      })
      .catch(() => {
        // No npm 'gsap' to resolve — some pages load it from a CDN <script>
        // tag instead, where it's only reachable as window.gsap. Same
        // caveat applies either way: this only enables detection if it's
        // the exact same instance the page's own animations were created
        // with, which a CDN global always is (there's only one).
        gsap = typeof window !== 'undefined' ? window.gsap ?? null : null;
        return gsap;
      });
  }
  return pending;
}
