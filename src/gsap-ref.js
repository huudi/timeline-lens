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
let attempts = 0;
const MAX_ATTEMPTS = 5;

// Only detects animations still running (or paused/scroll-gated) at the
// moment of the first scanExisting() call after this resolves.
// gsap.globalTimeline has autoRemoveChildren: true, so a short, non-gated
// tween/timeline that starts on page load can run to completion and be
// unlinked before this settles — the same category of gap motion-ref.js
// documents for Motion attribution, just unstated here until now. Priming
// the import at module-eval time (see the call at the bottom of this file)
// rather than waiting for index.js's init() to request it shrinks that
// window as much as this detection strategy allows, but cannot close it
// entirely: it's still a network/module fetch racing page-load animations.
function attempt() {
  attempts += 1;
  return import('gsap')
    .then((mod) => {
      gsap = mod.gsap ?? mod.default ?? mod;
      return gsap;
    })
    .catch((err) => {
      // No npm 'gsap' to resolve — some pages load it from a CDN <script>
      // tag instead, where it's only reachable as window.gsap. Same
      // caveat applies either way: this only enables detection if it's
      // the exact same instance the page's own animations were created
      // with, which a CDN global always is (there's only one).
      gsap = typeof window !== 'undefined' ? window.gsap ?? null : null;
      if (!gsap && attempts < MAX_ATTEMPTS) {
        // Likely a transient failure (e.g. a dev-server dependency
        // re-optimization racing this request) rather than "gsap really
        // isn't installed" — retry a bounded number of times instead of
        // caching a one-shot failure forever, which would otherwise
        // silently disable GSAP detection for the rest of the session.
        pending = null;
        return ensureGsap();
      }
      if (!gsap) {
        console.warn(
          '[timeline-lens] Could not resolve a gsap instance after',
          attempts,
          'attempt(s); GSAP animations will not be detected. Original error:',
          err,
        );
      }
      return gsap;
    });
}

// When gsap IS installed, this resolves to the exact same module instance
// the host page uses, which is what makes gsap.globalTimeline inspection
// possible at all. Safe to call more than once; only the first in-flight
// call actually attempts the import (subsequent calls share that promise,
// or start a fresh bounded retry if every prior attempt failed).
export function ensureGsap() {
  if (!pending) pending = attempt();
  return pending;
}

// Fire immediately on module evaluation — see the comment above attempt()
// for why starting this fetch as early as possible matters. index.js's
// init() still awaits ensureGsap() itself, so this is purely a head start,
// not a replacement for that await.
ensureGsap();
