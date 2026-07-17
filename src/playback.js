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

import { reconstructedInstance, peekReconstructed } from './reconstruct.js';
import { reconstructedCssInstance, peekReconstructedCss } from './reconstruct-css.js';

const isCssNode = (node) => !!node.engine && node.engine !== 'gsap';

// ---- gsap branch ------------------------------------------------------------

// Builds the reconstruction if needed. Only call this for explicit,
// user-initiated actions (play/pause/seek/speed). Never call it just to
// read state for display (see peekInstance below): building a reconstructed
// `.from()`/`.fromTo()` renders its start state on the real page as a side
// effect of construction, so doing that just because a row is on screen
// would visibly snap the page back without the user asking for it.
function instanceFor(node) {
  return node.isCompleted ? reconstructedInstance(node) : node.ref;
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
  return leaf.isCompleted ? reconstructedCssInstance(leaf) : leaf.ref;
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
