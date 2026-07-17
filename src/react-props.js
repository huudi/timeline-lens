// Live-DOM detection of React's own click wiring (`onClick={...}`), the
// React-world equivalent of source.js's `addEventListener('click', ...)`
// scan. Deliberately NOT a source-text scan the way that one is: every real
// React toolchain (Vite, webpack, Next.js, Turbopack, dev or minified prod)
// compiles JSX to a `jsxDEV(tag, props, ...)` / `jsx(tag, props)` call
// before the browser ever fetches the file — confirmed empirically by
// curling what Vite's dev server actually serves for a `.jsx` file — so
// there is no `<button onClick={fn}>` text anywhere in what source.js's
// same-origin fetch can see, in any real setup, ever. The only place the
// original relationship still exists at all is on the live, already-
// rendered DOM: React stamps every DOM node it manages with a
// `__reactProps$<random>` own-property holding that exact node's real,
// current props object. This is the same "inspect the live instance, not a
// source guess" approach gsap-ref.js/detect.js already take for GSAP —
// applied to React instead of re-deriving it from static text.
//
// Only ever sees a JSX `onClick` prop specifically — NOT a real, directly-
// attached `addEventListener('click', ...)` call reached via a React ref
// (`someRef.current.addEventListener(...)`), even though that's just as
// React-flavoured a pattern: React 17+'s own synthetic event system
// delegates most listeners to a single root container rather than
// attaching one per interactive element, so there is no per-element
// listener for a wrap of addEventListener to see there either way — the
// props store is genuinely the only live signal for a JSX onClick. See
// click-ref.js for the complementary, real-listener-capture signal that
// catches the ref/addEventListener shape instead.

import { componentBoundaryElement, labelMatches } from './dom-boundary.js';

function hasOnClickProp(el) {
  const propsKey = Object.keys(el).find((k) => k.startsWith('__reactProps$'));
  return !!propsKey && typeof el[propsKey].onClick === 'function';
}

// Click-triggered elements for a detected node's own real, current DOM
// targets — the React-world counterpart to source.js's findClickTriggers,
// called the same way (merged into the same `strong` tier in
// PropertiesPanel.js, since a live onClick read is just as unambiguous
// proof of click wiring as a matched `addEventListener('click', ...)`
// call), but synchronous: nothing here needs a network fetch, it's reading
// props already sitting on elements already in the DOM. Elements that are
// no longer attached (a completed, `isCompleted` node whose target was since
// unmounted) may have gone through React's own unmount cleanup already —
// this fails open (empty array) rather than throwing either way, since a
// removed element's Fiber can end up in an inconsistent state React itself
// no longer maintains.
export function reactClickTriggers(targets) {
  const found = new Set();
  for (const target of targets || []) {
    if (typeof Element === 'undefined' || !(target instanceof Element)) continue;
    try {
      const boundary = componentBoundaryElement(target);
      for (const label of labelMatches(boundary, hasOnClickProp)) found.add(label);
    } catch {
      // Unmounted/inconsistent Fiber state — see header comment above.
    }
  }
  return [...found];
}
