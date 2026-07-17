// Shared DOM-proximity helpers for the live click-trigger signals
// (react-props.js's Fiber-props read, click-ref.js's captured-listener
// read) — both need "the region of the DOM this animated element's sibling
// controls are expected to live in" and "a readable label for a live
// Element", so those two live here once rather than duplicated per caller.

// Walks `el`'s own Fiber (`.return` pointers, via its `__reactFiber$...` own
// property) up to the nearest ancestor Fiber whose `type` is a function —
// i.e. crosses out of whichever component actually rendered `el` and into
// its parent — and returns the last real DOM element seen before that
// crossing: the root DOM node of the nearest enclosing component's own
// rendered output. This is the live-DOM equivalent of source.js's
// expandToComponent (which walks identifier references to find "the whole
// top-level statement/component" in source text): the boundary a sibling
// control like a carousel's prev/next button is expected to live within,
// even though it isn't a DOM ancestor OR descendant of the animated element
// itself, just a sibling rendered by the same component. Falls back to `el`
// itself when it isn't managed by React at all (no `__reactFiber$` key —
// this also just does the right, narrow thing for a plain vanilla page: the
// search below ends up scoped to `el`'s own subtree only, which is
// correct, since without React there's no live signal for "which wider
// region counts as the same component" at all), or when no function-type
// Fiber is found within `maxSteps` (a malformed/unusually deep tree
// shouldn't turn this into an unbounded walk).
export function componentBoundaryElement(el, maxSteps = 60) {
  const fiberKey = Object.keys(el).find((k) => k.startsWith('__reactFiber$'));
  if (!fiberKey) return el;
  let fiber = el[fiberKey];
  let boundary = el;
  let steps = 0;
  while (fiber && steps < maxSteps) {
    if (typeof fiber.type === 'function') break;
    if (fiber.stateNode instanceof Element) boundary = fiber.stateNode;
    fiber = fiber.return;
    steps++;
  }
  return boundary;
}

// The same id-over-class-over-tag label priority detect.js's targetLabel and
// source.js's selectorGuess already use elsewhere in this package, applied
// to a live Element instead of a JSX/DOM-query match.
export function elementLabel(el) {
  if (el.id) return `#${el.id}`;
  if (el.classList.length) return `${el.tagName.toLowerCase()}.${el.classList[0]}`;
  return el.tagName.toLowerCase();
}

// Walks `root` and every descendant, calling `visit(el)` for each — the
// plain recursive DOM walk both live click-trigger signals scan their
// component boundary with.
export function walkSubtree(root, visit) {
  visit(root);
  for (const child of root.children) walkSubtree(child, visit);
}

// Labels for every element in `root`'s subtree that `predicate` matches,
// deduped, with a selector matched on more than one element (a
// `.map()`-rendered list of nav dots, the live-DOM equivalent of
// source.js's `.forEach()` `(each)` suffix) reported once, suffixed
// `(each)`, rather than once per element.
export function labelMatches(root, predicate) {
  const counts = new Map();
  walkSubtree(root, (el) => {
    if (predicate(el)) {
      const label = elementLabel(el);
      counts.set(label, (counts.get(label) || 0) + 1);
    }
  });
  return [...counts.entries()].map(([label, count]) => (count > 1 ? `${label} (each)` : label));
}
