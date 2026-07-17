// Timeline Lens, entry point.
//
// Usage (dev-only guard):
//   if (import.meta.env.DEV) {
//     import('timeline-lens').then((m) => m.init());
//   }

import { render } from 'preact';
import { html } from 'htm/preact';
import { App } from './ui/App.js';
import { cssText } from './styles.js';
import { gsap, ensureGsap } from './gsap-ref.js';
import { ensureMotionAttribution } from './motion-ref.js';
import { mountHighlight } from './highlight.js';
import { scanExisting } from './detect.js';
import { scanCssAnimations } from './detect-css.js';
import { entries, selectedId, panelOpen, miniOpen, tick, loopIds } from './store.js';
import { isFinished, restart } from './playback.js';

let mounted = false;
// Cleanup handles for the currently active mount, so destroy() can undo
// exactly what mount() set up — the interval, both listeners, the ticker
// (or its rAF fallback), and the shadow-root host — without leaking any of
// them across an init()/destroy()/init() cycle.
let host = null;
let intervalId = null;
let onVisibilityChange = null;
let onResize = null;
let onTick = null;
let rafId = null;
let pendingMount = null;

// Cheap structural fingerprint of a scan result, so the entries signal (and
// with it the whole Preact tree) only updates when something actually
// changed — detection nodes are mutated in place across rescans, so without
// this every 500ms interval scan published a fresh array and re-rendered the
// UI even when the page's animations were completely static.
function signatureOf(found) {
  let sig = '';
  const walk = (n) => {
    sig += `${n.id}|${n.label}|${n.duration}|${n.start}|${n.isCompleted ? 1 : 0}|${n.repeat};`;
    for (const c of n.children || []) walk(c);
  };
  for (const n of found) walk(n);
  return sig;
}

let lastSignature = null;

function rescan() {
  // Two detection sources, one list: the gsap.globalTimeline walk and the
  // document.getAnimations() poll (CSS animations/transitions and
  // element.animate() calls, see detect-css.js).
  const found = [...scanExisting(), ...scanCssAnimations()];
  const sig = signatureOf(found);
  if (sig !== lastSignature) {
    lastSignature = sig;
    entries.value = found;
  }
  // Nothing to inspect until something's selected; default to the first
  // detected entry so the panel isn't empty the moment it's opened.
  if (!selectedId.value && found.length) selectedId.value = found[0].id;
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export async function init() {
  if (mounted || typeof document === 'undefined') return;
  mounted = true;

  // gsap is an optional peer dependency, resolved once up front, so the
  // rest of mount() can synchronously check the live `gsap` binding instead
  // of every caller having to await it separately.
  await ensureGsap();

  // Installed as early as possible so as many .animate() calls as possible
  // get an accurate captured call-site (see motion-ref.js); activation is a
  // dev-only dynamic import that necessarily runs after the host page's own
  // top-level script code, so this still misses page-load-time calls, an
  // accepted limitation, not something installing any earlier can fix.
  ensureMotionAttribution();

  const mount = () => {
    host = document.createElement('div');
    host.id = 'timeline-lens';
    host.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;z-index:2147483000;';
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = cssText;
    shadow.appendChild(style);
    const root = document.createElement('div');
    shadow.appendChild(root);

    mountHighlight(shadow);

    // Scan immediately: gsap.globalTimeline auto-removes completed children,
    // so page-load animations must be captured before they finish.
    rescan();

    // Ongoing detection: pick up animations started after mount. Skipped
    // while the tab is hidden — nothing new can be observed or displayed,
    // and the snapshot model catches up on the first scan after it's
    // visible again (a visibilitychange listener forces that immediately).
    intervalId = setInterval(() => {
      if (!document.hidden) rescan();
    }, 500);
    onVisibilityChange = () => {
      if (!document.hidden) rescan();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    // gsap.matchMedia() reverts/recreates real timelines as breakpoints are
    // crossed; re-running the detection walk on resize is all that's
    // needed to reflect whichever breakpoint is currently active. Debounced
    // since resize fires continuously while dragging.
    onResize = debounce(rescan, 150);
    window.addEventListener('resize', onResize);

    // Drives live (non-interacted) playhead movement in the track view.
    // Prefer gsap's own ticker when it's installed; it's already the
    // requestAnimationFrame loop driving the host page's real animations.
    // Fall back to a plain rAF loop when gsap isn't present, so CSS/WAAPI-only
    // pages still get a moving playhead.
    let last = 0;
    onTick = (time) => {
      if (time - last < 1 / 20) return; // throttle to ~20fps
      last = time;
      // Loop restarts must keep working even with every surface closed (the
      // toggle survives closing the panel), but bumping the tick signal
      // re-renders live playheads/readouts — pure waste when neither the
      // panel nor the mini player is on screen to show them.
      if (panelOpen.value || miniOpen.value) tick.value++;
      for (const id of loopIds.value) {
        const entry = entries.value.find((e) => e.id === id);
        if (entry && isFinished(entry)) restart(entry);
      }
    };
    if (gsap) {
      gsap.ticker.add(onTick);
    } else {
      const raf = (ms) => {
        onTick(ms / 1000);
        rafId = requestAnimationFrame(raf);
      };
      rafId = requestAnimationFrame(raf);
    }

    render(html`<${App} />`, root);
  };

  if (document.body) {
    mount();
  } else {
    // Stashed so destroy() can cancel it if called before this fires —
    // otherwise a destroy() during this window would be silently undone
    // the moment DOMContentLoaded arrives.
    pendingMount = () => {
      pendingMount = null;
      mount();
    };
    document.addEventListener('DOMContentLoaded', pendingMount, { once: true });
  }
}

// Fully tears the studio down: stops detection/ticking, removes both
// listeners, and unmounts the shadow-root host — the trigger button and
// panel disappear completely, not just closed. Safe to call when nothing is
// mounted yet (e.g. before the DOMContentLoaded mount() above has run).
// init() can be called again afterward to remount from scratch.
export function destroy() {
  if (!mounted) return;
  mounted = false;

  if (pendingMount) {
    document.removeEventListener('DOMContentLoaded', pendingMount);
    pendingMount = null;
    return; // mount() never ran — nothing else was set up yet
  }

  if (intervalId != null) clearInterval(intervalId);
  intervalId = null;
  if (onVisibilityChange) document.removeEventListener('visibilitychange', onVisibilityChange);
  onVisibilityChange = null;
  if (onResize) window.removeEventListener('resize', onResize);
  onResize = null;
  if (gsap && onTick) gsap.ticker.remove(onTick);
  onTick = null;
  if (rafId != null) cancelAnimationFrame(rafId);
  rafId = null;

  host?.remove();
  host = null;

  // Reset detection state so a later init() starts from a clean scan
  // instead of showing stale entries from the previous mount.
  entries.value = [];
  selectedId.value = null;
  lastSignature = null;
}

// Convenience for wiring the studio to a single runtime switch — a
// keyboard shortcut, a dev-menu button, whatever fits your project — rather
// than every caller having to track `mounted` state itself.
export async function toggle() {
  if (mounted) destroy();
  else await init();
}
