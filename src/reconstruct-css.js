// Builds a scrubbable, paused Web Animations API Animation from a completed
// CSS/WAAPI leaf node's last-known snapshot (keyframes + timing, see
// detect-css.js), for animations the browser has already dropped from
// document.getAnimations() (finished transitions, finished fill:none
// animations). The WAAPI mirror of reconstruct.js, and simpler: keyframes
// from getKeyframes() are plain data, so there are no callbacks to strip.
//
// Every Animation built here is registered in a WeakSet so the detection
// scan can skip it (see isOwnAnimation), otherwise a reconstruction would
// show up on the very next document.getAnimations() poll as a brand-new
// animation and appear in the list twice.

const cache = new WeakMap(); // leaf node -> built Animation
const own = new WeakSet(); // Animations the studio itself created

export function isOwnAnimation(anim) {
  return own.has(anim);
}

function build(node) {
  const el = node.targets[0];
  if (!el || !el.isConnected || !node.keyframes?.length) return null;
  // getKeyframes() reports both `offset` (authored, possibly null) and
  // `computedOffset` (always resolved), element.animate() only understands
  // `offset`, so fold the computed one in and drop the rest.
  const frames = node.keyframes.map(({ computedOffset, ...k }) => ({
    ...k,
    offset: k.offset ?? computedOffset,
  }));
  try {
    const anim = el.animate(frames, {
      duration: Math.max(1, (node.duration || 0) * 1000),
      delay: (node.delay || 0) * 1000,
      iterations: node.repeat === -1 ? Infinity : (node.repeat || 0) + 1,
      direction: node.direction || 'normal',
      easing: node.easing || 'linear',
      // The original may have been fill:none (which is why it's gone), a
      // reconstruction that held no state while scrubbed would show nothing.
      fill: 'both',
      pseudoElement: node.pseudoElement || undefined,
    });
    anim.pause();
    anim.currentTime = 0;
    own.add(anim);
    return anim;
  } catch {
    return null;
  }
}

// Building a reconstruction renders its first keyframe on the real page
// immediately (fill: 'both' at currentTime 0), same side effect as
// reconstruct.js building a `.from()` tween, and handled the same way: only
// build on explicit user action (play/scrub), never just for display. See
// peekReconstructedCss.
export function reconstructedCssInstance(node) {
  // Scroll-driven animations persist in getAnimations() for as long as their
  // subject exists, and a time-based rebuild of one would be meaningless.
  if (node.progressDomain) return null;
  if (cache.has(node)) return cache.get(node);
  const inst = build(node);
  if (inst) cache.set(node, inst);
  return inst;
}

// Read-only: returns the cached instance only if the user already built one
// by playing/scrubbing, never builds (and never touches the page) on its own.
export function peekReconstructedCss(node) {
  return cache.get(node) || null;
}

// Called when detect-css.js revives a leaf for a retriggered real animation
// (a re-fired transition/animation is a brand-new Animation object for the
// same element + name/property). The stale reconstruction is cancelled, not
// just dropped: it was built with fill:'both', so left alive it would keep
// overriding the newly retriggered real animation's styles.
export function forgetCssReconstruction(node) {
  const inst = cache.get(node);
  if (inst) {
    try {
      inst.cancel();
    } catch {}
    cache.delete(node);
  }
}
