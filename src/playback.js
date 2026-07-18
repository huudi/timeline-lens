// Transport controls for detected animations: thin wrappers around the real
// instance's own methods (or, for a completed entry, its reconstructed
// stand-in, see reconstruct.js / reconstruct-css.js). Nothing here is a
// studio-authored animation; every call mutates the host page's own gsap or
// Web Animations API instance.
//
// Dispatches on node.engine: the GSAP branch is unchanged; the CSS/WAAPI
// branch normalises the Web Animations API's units into the model the GSAP
// side established (milliseconds to seconds, playbackRate to speed,
// playState to playing). CSS group nodes (a @keyframes across N elements, an
// element's transitions, see detect-css.js) have no single instance, so
// transport ops fan out across every child's own Animation.

import { gsap } from './gsap-ref.js';
import { reconstructedInstance, peekReconstructed, forgetReconstruction } from './reconstruct.js';
import { reconstructedCssInstance, peekReconstructedCss, forgetCssReconstruction } from './reconstruct-css.js';

const isCssNode = (node) => !!node.engine && node.engine !== 'gsap';

// ---- force-renderable targets -----------------------------------------------
//
// A completed animation's targets can be genuinely unrenderable by the time
// anyone tries to replay it: a splash/loader screen the host page sets
// `display:none` on once its own real intro finishes, a `hidden` attribute,
// an unmounted-then-remounted React node, etc. None of that is part of any
// node's captured vars/keyframes, so no amount of correct scrubbing ever
// makes it visible — the element itself just doesn't paint. Forced here,
// gated exactly like building a reconstruction (see instanceFor/
// cssInstanceFor below): only as a direct result of an explicit
// play/pause/seek/speed call, never as a side effect of merely selecting or
// displaying a row. Tracked in a plain Map (not a WeakMap) so
// restoreForcedVisibility() can undo every override in one pass — index.js's
// destroy() calls it, so turning the studio off leaves no trace on the host
// page, same guarantee destroy() already makes for the trigger/panel/interval.
const forcedVisible = new Map(); // element -> its original inline `display`

function forceVisible(target) {
  if (!(target instanceof Element) || forcedVisible.has(target) || !target.isConnected) return;
  if (getComputedStyle(target).display !== 'none') return;
  forcedVisible.set(target, target.style.display);
  target.style.display = '';
  // Clearing the inline style isn't enough when a stylesheet rule (a class,
  // a media query) is what's actually hiding it rather than an inline style
  // — fall back to a value that's guaranteed to paint. Best-effort, same as
  // reconstruct.js's own tweens: this is a debugging aid, not a pixel-perfect
  // restoration of whatever layout role `display` originally played.
  if (getComputedStyle(target).display === 'none') target.style.display = 'block';
}

// Recurses into timeline children / CSS group children alike (both shapes
// carry a `children` array, empty for a leaf — see detect.js/detect-css.js),
// so a single call at the top level of instanceFor/cssInstanceFor reaches
// every real target underneath, whichever engine built the node.
function forceTargetsVisible(node) {
  for (const child of node.children || []) forceTargetsVisible(child);
  for (const t of node.targets || []) forceVisible(t);
}

// Undoes every forceVisible() override made this session.
export function restoreForcedVisibility() {
  for (const [el, display] of forcedVisible) el.style.display = display;
  forcedVisible.clear();
}

// ---- gsap branch ------------------------------------------------------------

// Builds the reconstruction if needed. Only call this for explicit,
// user-initiated actions (play/pause/seek/speed). Never call it just to
// read state for display (see peekInstance below): building a reconstructed
// `.from()`/`.fromTo()` renders its start state on the real page as a side
// effect of construction, so doing that just because a row is on screen
// would visibly snap the page back without the user asking for it.
function instanceFor(node) {
  if (!node.isCompleted) return node.ref;
  forceTargetsVisible(node);
  return reconstructedInstance(node);
}

// Read-only: never builds a reconstruction, so it's safe to call from
// render for passive display (playheads, time readouts).
function peekInstance(node) {
  return node.isCompleted ? peekReconstructed(node) : node.ref;
}

// ---- css/waapi branch -------------------------------------------------------

function cssLeaves(node) {
  return node.type === 'timeline' ? node.children : [node];
}

function cssInstanceFor(leaf) {
  if (!leaf.isCompleted) return leaf.ref;
  forceTargetsVisible(leaf);
  return reconstructedCssInstance(leaf);
}

function cssPeek(leaf) {
  return leaf.isCompleted ? peekReconstructedCss(leaf) : leaf.ref;
}

// Animation.currentTime is milliseconds on a document timeline, but a
// CSSNumericValue percentage on a scroll-driven one (progress-domain nodes
// normalise 100% to a duration of 1, see detect-css.js).
function cssTime(inst) {
  const t = inst.currentTime;
  if (t == null) return 0;
  if (typeof t === 'number') return t / 1000;
  return typeof t.value === 'number' ? t.value / 100 : 0;
}

function cssSeek(leaf, t) {
  const inst = cssInstanceFor(leaf);
  if (!inst) return;
  try {
    inst.pause();
    if (leaf.progressDomain) {
      inst.currentTime = CSS.percent(Math.max(0, Math.min(1, t)) * 100);
    } else {
      const span = (leaf.start || 0) + (leaf.duration || 0);
      inst.currentTime = Math.max(0, Math.min(t, span)) * 1000;
    }
  } catch {}
}

// ---- shared transport surface ----------------------------------------------

export function play(node) {
  if (!isCssNode(node)) {
    instanceFor(node)?.play();
    return;
  }
  for (const leaf of cssLeaves(node)) {
    const inst = cssInstanceFor(leaf);
    if (!inst) continue;
    try {
      // play() on a finished Animation resumes at the end and immediately
      // re-finishes, so rewind first: Play on a finished row should replay
      // it, matching how the gsap side behaves.
      if (inst.playState === 'finished') inst.currentTime = 0;
      inst.play();
    } catch {}
  }
}

export function pause(node) {
  if (!isCssNode(node)) {
    instanceFor(node)?.pause();
    return;
  }
  for (const leaf of cssLeaves(node)) {
    try {
      // peek, not instanceFor: a completed leaf with no reconstruction has
      // nothing running to pause. Building one just to pause it would
      // mutate the page (fill:'both' renders its first keyframe) for a
      // no-op. Same reasoning for setSpeed below.
      cssPeek(leaf)?.pause();
    } catch {}
  }
}

// Pausing before seeking keeps the change from being immediately overwritten
// by a still-playing parent timeline's next tick: GSAP skips paused
// children when it renders a parent's playhead forward. (The WAAPI branch
// pauses too, so the scrub itself holds rather than keeps playing.)
export function seek(node, t) {
  if (isCssNode(node)) {
    for (const leaf of cssLeaves(node)) cssSeek(leaf, t);
    return;
  }
  const inst = instanceFor(node);
  if (!inst) return;
  inst.pause();
  inst.time(Math.max(0, Math.min(t, inst.duration())), false);
}

export function setSpeed(node, v) {
  if (isCssNode(node)) {
    for (const leaf of cssLeaves(node)) {
      try {
        const inst = cssPeek(leaf);
        if (inst) inst.playbackRate = v;
      } catch {}
    }
    return;
  }
  instanceFor(node)?.timeScale(v);
}

export function isPlaying(node) {
  if (isCssNode(node)) {
    return cssLeaves(node).some((leaf) => cssPeek(leaf)?.playState === 'running');
  }
  const inst = peekInstance(node);
  return !!inst && !inst.paused();
}

export function currentTime(node) {
  if (isCssNode(node)) {
    // A group's children run in parallel (they're independent Animations),
    // so the furthest-along child is the group's effective playhead.
    return cssLeaves(node).reduce((max, leaf) => {
      const inst = cssPeek(leaf);
      return inst ? Math.max(max, cssTime(inst)) : max;
    }, 0);
  }
  return peekInstance(node)?.time() ?? 0;
}

// True once a node has played all the way through and stopped advancing.
// totalProgress (unlike time()/progress(), which cycle per-repeat) only
// reaches 1 after every repeat is exhausted, and never does for repeat:-1.
// Read-only, so safe to poll from a ticker.
export function isFinished(node) {
  if (isCssNode(node)) {
    const leaves = cssLeaves(node);
    return leaves.length > 0 && leaves.every((leaf) => cssPeek(leaf)?.playState === 'finished');
  }
  const inst = peekInstance(node);
  return !!inst && !inst.isActive() && inst.totalProgress() >= 1;
}

// Restarts a node from the top, used to auto-replay a finished node whose
// loop toggle is on. `.play(0)` both rewinds and resumes in one call.
export function restart(node) {
  if (isCssNode(node)) {
    for (const leaf of cssLeaves(node)) {
      const inst = cssInstanceFor(leaf);
      if (!inst) continue;
      try {
        inst.currentTime = 0;
        inst.play();
      } catch {}
    }
    return;
  }
  instanceFor(node)?.play(0);
}

// ---- reset --------------------------------------------------------------
//
// Different problem from forceTargetsVisible above: that one is about the
// *host page* hiding a target after the fact (display:none etc). This is
// about GSAP/WAAPI's own writes lingering on the target long after the
// animation itself is gone — a `.from()` intro's rendered end state, or
// wherever the playhead was left after scrubbing — which otherwise makes a
// target look "stuck" and can shadow whatever a fresh page-load run would
// actually look like. Explicit, user-initiated only (the reset button in
// ListView.js), same gating as every other mutating action in this file.

// GSAP leaves are whatever this node's subtree bottoms out at (a plain tween
// has no children, so it's its own only leaf) — mirrors forceTargetsVisible's
// walk, but collects rather than acting inline, since clearProps needs every
// leaf's targets gathered up front.
function collectGsapLeaves(node, out = []) {
  if (node.children?.length) {
    for (const child of node.children) collectGsapLeaves(child, out);
  } else {
    out.push(node);
  }
  return out;
}

// Killing a timeline kills its whole nested subtree too, but clearProps
// still has to run per leaf: only leaf tweens carry real `targets` (see
// detect.js's describe()), and clearProps needs GSAP's own property-name
// resolution (autoAlpha -> opacity+visibility, xPercent -> transform, etc.)
// to remove exactly what a tween wrote, not a raw style property guess.
export function resetNode(node) {
  if (isCssNode(node)) {
    for (const leaf of cssLeaves(node)) {
      const live = leaf.ref;
      const built = peekReconstructedCss(leaf);
      for (const inst of [live, built]) {
        try {
          inst?.cancel();
        } catch {}
      }
      forgetCssReconstruction(leaf);
    }
    return;
  }
  const live = node.ref;
  const built = peekReconstructed(node);
  for (const inst of [live, built]) {
    try {
      inst?.kill();
    } catch {}
  }
  forgetReconstruction(node);
  for (const leaf of collectGsapLeaves(node)) {
    if (leaf.targets?.length) {
      try {
        gsap.set(leaf.targets, { clearProps: 'all' });
      } catch {}
    }
  }
}
