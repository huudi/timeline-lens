// Detection of CSS animations, CSS transitions, and JS element.animate()
// calls (raw, or authored via the Motion library, see motion-ref.js)
// already running on the host page, via document.getAnimations(): the Web
// Animations API mirror of detect.js's gsap.globalTimeline walk. Pure
// inspection, same as the GSAP side: nothing here creates, mutates, or
// reverts anything the page itself set up.
//
// The browser drops an Animation from getAnimations() once it's no longer
// "relevant" (a finished transition, or a finished fill:none animation),
// with no event, only its absence on the next scan. Same model as GSAP's
// autoRemoveChildren, handled the same way: each leaf's descriptive fields
// double as a snapshot, and the moment it stops showing up it's flagged
// `isCompleted` (see reconstruct-css.js for the scrubbable stand-in).
// fill:forwards animations stay "relevant" after finishing and simply keep
// showing up with playState 'finished'.
//
// Grouping keeps busy pages sane and mirrors detect.js's timeline→children
// tree shape (type 'timeline' = has children, 'tween' = leaf), so the
// list/track views work unchanged:
//   - CSS animations group by animationName, one child per target element:
//     one @keyframes applied to ten elements is one entry, not ten.
//   - CSS transitions group by target element, one child per property.
//   - element.animate() calls stay one top-level node each.

import { targetLabel } from './detect.js';
import { forgetCssReconstruction, isOwnAnimation } from './reconstruct-css.js';
import { classifyCallSite } from './motion-ref.js';

let n = 0;
const nextId = () => `css-${++n}`;

// Both front-ends' mount hosts: the npm package's index.js and the browser
// extension's mount.js (this file is forked byte-for-byte into extension/src,
// so it must know both ids — the extension previously mounted under an id
// this check didn't cover, letting its own UI transitions into the list).
const HOST_IDS = new Set(['timeline-lens', 'timeline-lens-ext']);

// The studio's own UI animates too (button transitions inside the shadow
// root, hover-highlight boxes), never report those. closest() can't cross
// a shadow boundary, so walk root nodes instead.
function isStudioOwn(el) {
  let node = el;
  while (node) {
    if (node.id && HOST_IDS.has(node.id)) return true;
    const root = node.getRootNode ? node.getRootNode() : null;
    node = root && root.host ? root.host : null;
  }
  return false;
}

// Motion (motion.dev) never authors a CSS animation/transition, only a
// WAAPI-backed NativeAnimation (or a main-thread JSAnimation, invisible to
// document.getAnimations() entirely, see motion-ref.js); classify() only
// ever needs to consider Motion attribution for the plain-Animation
// fallback case.
function classify(anim) {
  if (typeof CSSTransition !== 'undefined' && anim instanceof CSSTransition) return 'css-transition';
  if (typeof CSSAnimation !== 'undefined' && anim instanceof CSSAnimation) return 'css-animation';
  return classifyCallSite(anim) ?? 'waapi';
}

// 'motion' and 'waapi' are both leaf, ungrouped, WAAPI-backed engines (see
// groupFor/findExistingLeaf below); this is the one place that distinction
// collapses so the two aren't treated as unrelated engines everywhere a
// leaf needs to be found/grouped, only where they're actually displayed
// differently (chips, colours, panel content, see ui/util.js).
const isWaapiLike = (engine) => engine === 'waapi' || engine === 'motion';

// ViewTimeline extends ScrollTimeline, so check the more specific one first.
// These are CSS scroll-driven animations (animation-timeline: scroll()/view()),
// the WAAPI cousin of ScrollTrigger. Feature-detected: on browsers without
// them, every animation is document-timeline and this returns null.
function scrollTimelineInfo(anim) {
  const tl = anim.timeline;
  if (!tl) return null;
  const isView = typeof ViewTimeline !== 'undefined' && tl instanceof ViewTimeline;
  const isScroll = typeof ScrollTimeline !== 'undefined' && tl instanceof ScrollTimeline;
  if (!isView && !isScroll) return null;
  return {
    kind: isView ? 'view' : 'scroll',
    axis: tl.axis || null,
    source: tl.source ? targetLabel(tl.source) : null,
    subject: isView && tl.subject ? targetLabel(tl.subject) : null,
  };
}

const KEYFRAME_META = new Set(['offset', 'computedOffset', 'easing', 'composite']);

export function keyframeProps(keyframes) {
  const props = new Set();
  for (const kf of keyframes || []) {
    for (const key of Object.keys(kf)) {
      if (!KEYFRAME_META.has(key)) props.add(key);
    }
  }
  return [...props];
}

function safeKeyframes(effect) {
  try {
    return effect.getKeyframes().map((k) => ({ ...k }));
  } catch {
    return [];
  }
}

function describeLeaf(anim, kind, target) {
  const effect = anim.effect;
  const timing = effect && typeof effect.getTiming === 'function' ? effect.getTiming() : {};
  const keyframes = effect && typeof effect.getKeyframes === 'function' ? safeKeyframes(effect) : [];
  const pseudo = (effect && effect.pseudoElement) || null;
  const scrollInfo = scrollTimelineInfo(anim);
  const iterations = timing.iterations ?? 1;
  const name = kind === 'css-animation' ? anim.animationName : null;
  const property = kind === 'css-transition' ? anim.transitionProperty : null;
  const targetName = targetLabel(target) + (pseudo || '');
  return {
    engine: kind,
    type: 'tween',
    label: kind === 'css-transition' ? property : kind === 'waapi' ? anim.id || targetName : targetName,
    name,
    property,
    targets: [target],
    vars: {},
    labels: null,
    // progress-domain (scroll-driven) durations are meaningless in seconds,
    // normalized to one unit representing 0–100% (see fmtTime in ui/util.js)
    progressDomain: !!scrollInfo,
    scrollInfo,
    duration: scrollInfo ? 1 : (typeof timing.duration === 'number' ? timing.duration : 0) / 1000,
    delay: scrollInfo ? 0 : (timing.delay || 0) / 1000,
    repeat: iterations === Infinity ? -1 : Math.max(0, Math.round(iterations) - 1),
    yoyo: /alternate/.test(timing.direction || ''),
    direction: timing.direction || 'normal',
    fill: timing.fill || 'none',
    easing: timing.easing || 'linear',
    pseudoElement: pseudo,
    keyframes,
    animatedProps: keyframeProps(keyframes),
  };
}

// live Animation object -> leaf node, for animations found this scan
const liveNodes = new WeakMap();
// top-level node ids in first-seen order, groups and waapi leaves mixed
const topLevelIds = [];
const nodesById = new Map();
// css-animation groups by animationName; css-transition groups per element
const animGroups = new Map(); // name -> group node
const transitionGroups = new Map(); // Element -> group node

function makeGroup(engine, label) {
  const group = {
    id: nextId(),
    ref: null,
    engine,
    type: 'timeline',
    label,
    targets: [],
    vars: {},
    labels: null,
    duration: 0,
    repeat: 0,
    yoyo: false,
    delay: 0,
    start: 0,
    isCompleted: false,
    progressDomain: false,
    children: [],
  };
  nodesById.set(group.id, group);
  topLevelIds.push(group.id);
  return group;
}

function groupFor(kind, desc, target) {
  if (kind === 'css-animation') {
    let group = animGroups.get(desc.name);
    if (!group) {
      group = makeGroup(kind, desc.name);
      animGroups.set(desc.name, group);
    }
    return group;
  }
  if (kind === 'css-transition') {
    let group = transitionGroups.get(target);
    if (!group) {
      group = makeGroup(kind, targetLabel(target));
      transitionGroups.set(target, group);
    }
    return group;
  }
  return null; // waapi/motion nodes are top-level leaves
}

// A retriggered CSS animation/transition is a brand-new Animation object
// each time it fires (hover on/off, class re-added), match it back to the
// existing leaf for the same element + name/property so re-fires update
// that row instead of appending a new one per trigger. The WAAPI mirror of
// detect.js's sameAnimation heuristic; an authored `id` on an
// element.animate() call is treated as authorial identity the same way an
// authored vars.id is on the GSAP side.
function findExistingLeaf(kind, desc, group) {
  if (group) {
    return group.children.find(
      (leaf) =>
        leaf.targets[0] === desc.targets[0] &&
        leaf.pseudoElement === desc.pseudoElement &&
        (kind === 'css-animation' ? leaf.name === desc.name : leaf.property === desc.property)
    );
  }
  const waapiLeaves = topLevelIds.map((id) => nodesById.get(id)).filter((node) => node && isWaapiLike(node.engine));
  return waapiLeaves.find((leaf) => {
    if (leaf.targets[0] !== desc.targets[0]) return false;
    if (leaf.label && desc.label && leaf.label === desc.label && desc.label !== targetLabel(desc.targets[0])) return true;
    return JSON.stringify(leaf.keyframes) === JSON.stringify(desc.keyframes);
  });
}

function upsertLeaf(anim, kind, target) {
  const desc = describeLeaf(anim, kind, target);
  const group = groupFor(kind, desc, target);
  let node = liveNodes.get(anim);
  if (!node) node = findExistingLeaf(kind, desc, group);
  if (!node) {
    node = { id: nextId(), ref: anim, isCompleted: false, start: desc.delay, children: [], ...desc };
    nodesById.set(node.id, node);
    if (group) group.children.push(node);
    else topLevelIds.push(node.id);
  } else {
    forgetCssReconstruction(node);
    Object.assign(node, desc, { ref: anim, isCompleted: false, start: desc.delay });
  }
  liveNodes.set(anim, node);
  return node;
}

function freezeLeaf(node) {
  node.isCompleted = true;
  node.ref = null;
}

// Group aggregates are re-derived from children every scan: the track ruler
// spans max(child start + duration), the transport's ∞ shows if any child
// loops forever, and a group only reads as completed once every child is.
function refreshGroup(group) {
  const kids = group.children;
  group.duration = kids.reduce((max, c) => Math.max(max, (c.start || 0) + (c.duration || 0)), 0);
  group.repeat = kids.some((c) => c.repeat === -1) ? -1 : 0;
  group.isCompleted = kids.length > 0 && kids.every((c) => c.isCompleted);
  group.progressDomain = kids.length > 0 && kids.every((c) => c.progressDomain);
}

export function scanCssAnimations() {
  let anims = [];
  try {
    anims = document.getAnimations();
  } catch {
    return [];
  }

  const seen = new Set();
  for (const anim of anims) {
    if (isOwnAnimation(anim)) continue;
    const target = anim.effect && anim.effect.target;
    if (!target || isStudioOwn(target)) continue;
    seen.add(upsertLeaf(anim, classify(anim), target));
  }

  for (const node of nodesById.values()) {
    if (node.type === 'tween' && node.ref && !seen.has(node)) freezeLeaf(node);
  }
  for (const group of animGroups.values()) refreshGroup(group);
  for (const group of transitionGroups.values()) refreshGroup(group);

  return topLevelIds.map((id) => nodesById.get(id)).filter(Boolean);
}
