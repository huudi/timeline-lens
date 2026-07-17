// Builds a scrubbable, paused gsap instance from a completed node's
// last-known snapshot (label/vars/duration/children, see detect.js), for
// nodes GSAP has already unlinked from globalTimeline. This is a labeled
// approximation, not the original: callbacks are stripped so they can't
// re-fire from scrubbing, and `vars.startAt`/`runBackwards` (GSAP's own
// encoding of `.from()`/`.fromTo()`) are passed straight through to `.to()`,
// which honors them identically; no need to special-case tween method.
//
// Built once per node and cached for the node's lifetime; the node object
// itself is stable across rescans (see detect.js), so the cache key is too.

import { gsap } from './gsap-ref.js';

const STRIP_KEYS = new Set([
  'onStart',
  'onStartParams',
  'onUpdate',
  'onUpdateParams',
  'onComplete',
  'onCompleteParams',
  'onRepeat',
  'onRepeatParams',
  'onReverseComplete',
  'onReverseCompleteParams',
  'onInterrupt',
  'onInterruptParams',
  'onToggle',
  // GSAP writes its own live back-reference to the containing timeline into
  // a nested tween's `.vars.parent`, captured verbatim by describe()'s
  // `{...anim.vars}` along with everything else. Passing it straight through
  // to a fresh `gsap.to()`/`gsap.timeline()` call here would re-parent the
  // rebuilt instance into that *original, already-completed* timeline
  // instead of the new one being built, which as a side effect re-links the
  // stale original back onto gsap.globalTimeline, resurrecting it as a
  // second, live-again top-level entry alongside the intended reconstruction.
  'parent',
]);

function cleanVars(vars) {
  const out = {};
  for (const [k, v] of Object.entries(vars || {})) {
    if (!STRIP_KEYS.has(k)) out[k] = v;
  }
  return out;
}

// node.duration was captured from anim.duration(), which for a staggered
// tween is the TOTAL length (per-target duration + stagger spread). Passing
// it back to gsap.to() as `duration` alongside the original `stagger` would
// re-add the spread on top of the total — and since a replayed
// reconstruction is re-scanned live (see nodeForInstance) and refreshes
// node.duration from itself, the error compounds on every replay
// (1.04s → 1.28s → 1.52s...). Recover the per-target duration instead:
// the authored vars.duration when there is one, otherwise total minus the
// spread for the stagger shapes it can be computed from.
function perTargetDuration(node) {
  const vars = node.vars || {};
  if (typeof vars.duration === 'number') return vars.duration;
  const stagger = vars.stagger;
  const count = node.targets.length;
  if (!stagger || count <= 1) return node.duration;
  const each = typeof stagger === 'number' ? stagger : typeof stagger.each === 'number' ? stagger.each : null;
  if (each != null) return Math.max(node.duration - Math.abs(each) * (count - 1), 0.01);
  if (typeof stagger.amount === 'number') return Math.max(node.duration - Math.abs(stagger.amount), 0.01);
  // function/advanced stagger: no way to recover the spread from the
  // snapshot; the total is the least-wrong value left.
  return node.duration;
}

function build(node) {
  // gsap is an optional peer dependency; a gsap-engine node can't exist
  // without it in the first place (see detect.js's scanExisting), but guard
  // anyway since this is the module that would otherwise crash on `gsap.to`.
  if (!gsap) return null;
  if (node.type === 'timeline') {
    // Carries the node's own label back in as `id` so describe() computes
    // the same label for the rebuilt instance; otherwise the row's name
    // would degrade to the generic "timeline" fallback the moment a
    // completed entry is replayed (nodeForInstance already keeps this from
    // becoming a *new* row; this keeps that row's name stable too).
    const tl = gsap.timeline({ paused: true, id: node.label });
    // Carry the authored labels over too: once a replayed reconstruction is
    // re-scanned live, describe() refreshes node.labels from this instance,
    // so leaving them off would wipe the label markers from the track view
    // the moment a completed entry is replayed.
    for (const [name, t] of Object.entries(node.labels || {})) tl.addLabel(name, t);
    for (const child of node.children) {
      const built = build(child);
      if (built) tl.add(built, child.start);
    }
    return tl;
  }
  if (!node.targets.length) return null;
  try {
    return gsap.to(node.targets, { ...cleanVars(node.vars), duration: perTargetDuration(node) });
  } catch {
    return null;
  }
}

const cache = new WeakMap(); // node -> built instance
// Reverse of the above: lets detect.js recognize a freshly-scanned
// top-level gsap instance as *this node's own reconstruction* rather than
// an unrelated new animation, so playing a completed entry updates its
// existing list row instead of appending a new one (see nodeForInstance).
const owningNode = new WeakMap(); // built instance -> node

// Building a reconstruction constructs a *real* gsap tween targeting the
// real page elements, which, for anything captured from a `.from()`/
// `.fromTo()` call (`runBackwards`/`startAt` in vars), renders its start
// state immediately as a side effect of construction, the same way the
// original `.from()` call did. That's fine when the user actually asked to
// play/scrub it, but must never happen just from the entry being selected
// or displayed. See peekReconstructed, used for passive reads.
export function reconstructedInstance(node) {
  if (cache.has(node)) return cache.get(node);
  const inst = build(node);
  if (inst) {
    inst.pause(0);
    cache.set(node, inst);
    owningNode.set(inst, node);
  }
  return inst;
}

// Read-only lookup used by detect.js's top-level scan: is this live gsap
// instance actually a reconstruction this module built for `node`? A
// reconstructed timeline/tween is a brand-new gsap object with no relation
// (by identity or by matching vars/label) to the node it stands in for, so
// scanExisting()'s usual "is this a known ref, or a re-run that looks like
// one already in the list" checks can't find it on their own.
export function nodeForInstance(inst) {
  return owningNode.get(inst) || null;
}

// Read-only lookup: returns the cached instance if one's already been built
// (i.e. the user has actually played/scrubbed it), without ever building,
// and therefore never touching the real page, on its own.
export function peekReconstructed(node) {
  return cache.get(node) || null;
}

// Called when detect.js revives a node for a new live instance (a re-run of
// what it recognizes as "the same" animation, see sameAnimation in
// detect.js) so a stale reconstruction built from the previous run's
// snapshot doesn't linger and get served once this run completes too.
export function forgetReconstruction(node) {
  cache.delete(node);
}
