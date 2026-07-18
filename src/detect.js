// Detection of GSAP animations already running on the host page. Pure
// inspection, nothing here creates, mutates, or reverts anything the page
// itself set up.
//
// `gsap.globalTimeline` has `autoRemoveChildren: true`, so a completed,
// non-repeating top-level tween/timeline is unlinked from it the moment it
// finishes; there's no event for this, only its absence on the next scan.
// Nested children of a page-authored timeline are NOT auto-removed (only
// globalTimeline itself has autoRemoveChildren on), so this only matters for
// top-level entries.
//
// Each top-level entry is tracked by object identity (a WeakMap from the
// live gsap instance to our node) for as long as it's still found on
// globalTimeline. The node's descriptive fields (label/vars/duration/...)
// are refreshed from the live instance on every scan. The moment an entry
// stops showing up, its node is flagged `isCompleted` and its fields simply
// stop being refreshed; the last-seen values double as the snapshot used to
// build a reconstructed copy for scrubbing (see reconstruct.js), since the
// live instance may itself be garbage collected once nothing else on the
// page references it.

import { gsap } from './gsap-ref.js';
import { forgetReconstruction, nodeForInstance } from './reconstruct.js';
import { callSiteFor } from './gsap-call-site.js';

let n = 0;
const nextId = () => `anim-${++n}`;

// Ordinal assigned once, at creation, to each new top-level node with no
// authored `vars.id` — in creation order, which for a normal
// synchronously-authored page matches the order its
// `gsap.timeline()/gsap.to()/...` call appears in source. source.js's
// findSource has no id or literal-selector to key an unlabeled top-level
// animation by (e.g. `gsap.timeline({...}).from(heading, ...)`, where
// `heading` is a local variable, not a selector string) — this gives it a
// last-resort positional key instead: source.js builds the same ordinal
// over unlabeled top-level calls found in the page's own scripts (sorted by
// file position), and matches index-for-index. A plain monotonic counter,
// not something recomputed from topLevelIds on every scan, so an ordinal
// already handed out never shifts under an existing node.
let nextUnlabeledTopLevelIndex = 0;

const isTimeline = (a) => !!gsap && a instanceof gsap.core.Timeline;

// gsap.delayedCall() / timeline.call() aren't animations: GSAP implements
// them as a real Tween whose *target* is the callback function itself (see
// Tween.delayedCall in gsap-core.js), so they show up on globalTimeline like
// any other tween. Plugins lean on this internally for their own scheduling
// (e.g. ScrollTrigger's resize-refresh debounce), which would otherwise
// surface in the list as a meaningless tween literally named "Function".
function isCallbackTween(anim) {
  if (isTimeline(anim) || typeof anim.targets !== 'function') return false;
  const targets = anim.targets();
  return targets.length === 1 && typeof targets[0] === 'function';
}

export function targetLabel(t) {
  if (typeof Element !== 'undefined' && t instanceof Element) {
    if (t.id) return `#${t.id}`;
    const cls = Array.from(t.classList);
    if (cls.length) return `${t.tagName.toLowerCase()}.${cls[0]}`;
    return t.tagName.toLowerCase();
  }
  if (t && t.constructor && t.constructor.name !== 'Object') return t.constructor.name;
  return 'object';
}

// A matchMedia()-scoped animation carries the Context it was created in via
// `_ctx`; only the per-condition Context MatchMedia.add() builds carries
// `.queries` (see describe.js's matchMediaConfig). Snapshotted here, on every
// scan while the instance is live, for the same reason every other field is:
// a matchMedia intro timeline finishes (and is auto-removed) within a second
// of page load, and reading `_ctx` lazily off node.ref at render time would
// come up empty for exactly the animations users most want to inspect.
function matchMediaSnapshot(anim) {
  const ctx = anim._ctx;
  if (!ctx?.queries) return null;
  return { queries: { ...ctx.queries }, conditions: { ...(ctx.conditions || {}) } };
}

// Captures ScrollTrigger's config off the live instance while it's still
// attached. GSAP nulls out `animation.scrollTrigger` the moment a `once:
// true` ScrollTrigger self-kills after firing — well before the
// animation's own node is ever marked completed (the tween/timeline itself
// keeps playing after the trigger fires, and a top-level entry isn't
// unlinked from gsap.globalTimeline until its own playback finishes).
// Reading `node.ref.scrollTrigger` lazily at render time (the old approach,
// see describe.js's scrollTriggerConfig) comes up empty for exactly the
// once-off triggers users most want to keep inspecting after they've
// fired. Snapshotted once, the first scan it's still there, and kept for
// the node's entire lifetime after — unlike matchMediaSnapshot above, this
// deliberately does NOT keep re-reading (and overwriting) on every scan
// once captured: a self-killed ScrollTrigger going away is never "more
// correct" than the last real config it had.
function scrollTriggerSnapshot(anim, existing) {
  const st = anim.scrollTrigger;
  if (!st) return existing || null;
  return {
    trigger: st.trigger,
    start: st.start,
    end: st.end,
    scrub: !!st.vars?.scrub,
    toggleActions: st.vars?.toggleActions || null,
    markers: st.vars?.markers ?? false,
  };
}

function describe(anim) {
  const tl = isTimeline(anim);
  const targets = !tl && typeof anim.targets === 'function' ? anim.targets() : [];
  const vars = anim.vars || {};
  const label =
    vars.id != null ? String(vars.id) : tl ? 'timeline' : targets.map(targetLabel).join(', ') || 'tween';
  return {
    matchMedia: matchMediaSnapshot(anim),
    engine: 'gsap',
    type: tl ? 'timeline' : 'tween',
    label,
    targets,
    vars: { ...vars },
    duration: anim.duration(),
    repeat: typeof anim.repeat === 'function' ? anim.repeat() : 0,
    yoyo: !!vars.yoyo,
    delay: typeof anim.delay === 'function' ? anim.delay() : 0,
    labels: tl ? { ...anim.labels } : null,
  };
}

// live gsap instance -> node, for entries currently linked into the tree
// being walked this scan (top-level and nested alike)
const knownByRef = new WeakMap();
// top-level node ids, in first-seen order: the persistent list returned by
// every scan, including completed entries whose ref has gone away
const topLevelIds = [];
const nodesById = new Map();

function sameTargets(a, b) {
  return a.length === b.length && a.every((t, i) => t === b[i]);
}

function serializableVars(vars) {
  try {
    // functions (callbacks) are dropped by JSON.stringify automatically, so
    // this compares only the actual tween/timeline config.
    return JSON.stringify(vars);
  } catch {
    return null;
  }
}

// Recognizes a brand-new top-level instance as a re-run of one already in
// the list, e.g. a click handler that builds a fresh gsap.timeline() on
// every click, rather than a genuinely distinct animation, so retriggering
// it updates that one row instead of appending a new entry every time it
// fires. Object identity can't catch this since the re-run is a new object.
//
// An explicit `vars.id` is treated as authorial identity and short-circuits
// the rest of the comparison: a carousel/slider that rebuilds the same
// named tween against whichever element is active this cycle (different
// `targets` each time) is still one authored animation, not a new one per
// element it happens to have touched.
function sameAnimation(a, b) {
  if (a.type !== b.type || a.label !== b.label) return false;
  if (a.vars?.id != null && b.vars?.id != null) return true;
  return sameTargets(a.targets, b.targets) && serializableVars(a.vars) === serializableVars(b.vars);
}

function upsertNode(anim, start, topLevel) {
  let node = knownByRef.get(anim);
  const desc = describe(anim);
  let revived = false;
  if (!node && topLevel) {
    // Playing a completed entry rebuilds it as a brand-new gsap instance
    // (see reconstruct.js), check whether that's what this is *first*,
    // since its vars/label generally won't match the node it stands in for
    // well enough for sameAnimation's heuristic below to find it.
    node = nodeForInstance(anim) || topLevelIds.map((id) => nodesById.get(id)).find((n) => n && sameAnimation(n, desc));
    revived = !!node;
  }
  // Resolved after the revived-lookup above (not inside describe()) so a
  // revived reconstruction — whose fresh gsap instance never has a real
  // ScrollTrigger attached, see reconstruct.js — inherits the original
  // node's already-captured snapshot instead of clobbering it with null.
  desc.scrollTrigger = scrollTriggerSnapshot(anim, node?.scrollTrigger);
  if (!node) {
    node = { id: nextId(), ref: anim, isCompleted: false, start, ...desc, children: [] };
    node.topLevel = topLevel;
    if (topLevel && desc.vars?.id == null) node.unlabeledIndex = nextUnlabeledTopLevelIndex++;
    // Only ever set for an instance created after gsap-call-site.js's wrap
    // installed (see its header comment) — an exact, order-independent
    // alternative to unlabeledIndex above for source.js's findSource to
    // prefer whenever it's available. Captured once, at first sight, same
    // as unlabeledIndex: a call site never changes across rescans.
    if (topLevel) node.callSite = callSiteFor(anim);
    knownByRef.set(anim, node);
    nodesById.set(node.id, node);
  } else {
    knownByRef.set(anim, node);
    if (revived) forgetReconstruction(node);
    Object.assign(node, desc, { ref: anim, isCompleted: false, start });
  }
  if (desc.type === 'timeline') {
    node.children = anim
      .getChildren(false, true, true)
      .filter((child) => !isCallbackTween(child))
      .map((child) => upsertNode(child, typeof child.startTime === 'function' ? child.startTime() : 0, false));
  }
  return node;
}

function freeze(node) {
  node.isCompleted = true;
  node.ref = null;
  for (const child of node.children) freeze(child);
}

export function scanExisting() {
  // gsap is an optional peer dependency: nothing to walk when it's absent
  // (see gsap-ref.js); CSS/WAAPI detection in detect-css.js runs regardless.
  if (!gsap) return [];
  const found = gsap.globalTimeline.getChildren(false, true, true);
  const seen = new Set();

  for (const anim of found) {
    if (isCallbackTween(anim)) continue;
    const node = upsertNode(anim, 0, true);
    seen.add(node.id);
    if (!topLevelIds.includes(node.id)) topLevelIds.push(node.id);
  }

  for (const id of topLevelIds) {
    const node = nodesById.get(id);
    if (node && !seen.has(id) && !node.isCompleted) freeze(node);
  }

  return topLevelIds.map((id) => nodesById.get(id)).filter(Boolean);
}
