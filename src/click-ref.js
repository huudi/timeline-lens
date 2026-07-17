// Live capture of `addEventListener('click', ...)` calls, the direct-DOM-
// listener counterpart to motion-ref.js's `Element.prototype.animate` wrap
// and react-props.js's live props read. Nothing in source text — vanilla or
// compiled JSX — needs to be parsed for this to know exactly which element
// a real 'click' listener was attached to, including an element reached
// only through a React ref's imperative `someRef.current.addEventListener(
// 'click', ...)` (a pattern with no reliable source-text signal at all,
// short of resolving which JSX element a `ref={someRef}` attribute belongs
// to from bundler-specific, minification-fragile compiled output — see
// source.js's header comment on why that's avoided instead of attempted).
//
// Complementary to, not a replacement for, react-props.js's
// reactClickTriggers: React 17+'s own synthetic event system delegates most
// listeners to a single root container rather than attaching one per
// interactive element, so this wrap never sees a JSX `onClick` prop at all
// — that's exactly why reactClickTriggers reads React's own live props
// store instead, for that shape specifically. This module only ever sees
// *real*, directly-attached DOM listeners: a plain `el.addEventListener(
// 'click', ...)` call, whether authored in vanilla JS or reached via a
// React ref — both are the exact same call from the DOM's own point of
// view, so both are caught the same way, automatically, with nothing
// React-specific about this file at all.

import { componentBoundaryElement, labelMatches } from './dom-boundary.js';

const clickBoundElements = new WeakSet();
let wrapped = false;

// Wraps EventTarget.prototype.addEventListener exactly once, passthrough
// (calls the native implementation immediately, synchronously, with the
// same arguments and return value; every event type other than 'click'
// passes straight through untouched) — purely to observe which elements a
// real 'click' listener was attached to. Safe to call more than once; only
// the first call actually wraps.
export function ensureClickListenerAttribution() {
  if (wrapped || typeof EventTarget === 'undefined') return;
  wrapped = true;
  const native = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (type, ...rest) {
    if (type === 'click' && typeof Element !== 'undefined' && this instanceof Element) {
      clickBoundElements.add(this);
    }
    return native.call(this, type, ...rest);
  };
}

function hasLiveClickListener(el) {
  return clickBoundElements.has(el);
}

// Click-triggered elements for a detected node's own real, current DOM
// targets, found via captured addEventListener('click', ...) calls rather
// than a source-text guess — see react-props.js's reactClickTriggers (same
// signature, same component-boundary search, meant to be merged into the
// same `strong` tier) for the JSX-onClick-prop counterpart this doesn't
// cover.
export function liveClickTriggers(targets) {
  const found = new Set();
  for (const target of targets || []) {
    if (typeof Element === 'undefined' || !(target instanceof Element)) continue;
    try {
      const boundary = componentBoundaryElement(target);
      for (const label of labelMatches(boundary, hasLiveClickListener)) found.add(label);
    } catch {
      // Same "don't let an unmounted/inconsistent tree throw" stance as
      // reactClickTriggers in react-props.js.
    }
  }
  return [...found];
}
