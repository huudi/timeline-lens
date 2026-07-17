// Best-effort, read-only inspection helpers for the Code panel, a
// reconstruction of what a detected animation's authoring call probably
// looked like, plus which plugins/triggers it uses. Purely informational:
// there's nothing to copy back into the host project, no diffing, no
// import/export; the studio doesn't author anything (see README).

import { gsap } from './gsap-ref.js';

// GSAP registers every plugin into `gsap.plugins`, keyed by the exact vars
// property that activates it (e.g. `motionPath`, `drawSVG`, `inertia`), the
// same map GSAP itself consults at tween-creation time to resolve a special
// property. Reading it directly (rather than hand-maintaining a name list
// here) means detection stays correct as new plugins ship, and covers
// anything the host project has registered, not just a fixed subset.
function pluginDisplayName(key) {
  return (key === 'css' ? 'CSS' : key.charAt(0).toUpperCase() + key.slice(1)) + 'Plugin';
}

export function detectPlugins(node) {
  const found = new Set();
  const registry = gsap?.plugins || {};
  const scan = (n) => {
    for (const key of Object.keys(n.vars || {})) {
      if (registry[key]) found.add(pluginDisplayName(key));
    }
    if (n.ref?.scrollTrigger) found.add('ScrollTrigger');
    for (const child of n.children || []) scan(child);
  };
  scan(node);
  return [...found];
}

function selectorGuess(targets) {
  const els = (targets || []).filter((t) => typeof Element !== 'undefined' && t instanceof Element);
  if (!els.length) return null;
  const el = els[0];
  if (el.id) return `#${el.id}`;
  if (el.classList.length) return `.${el.classList[0]}`;
  return el.tagName.toLowerCase();
}

// A ScrollTrigger-linked animation exposes the real, live ScrollTrigger
// instance via `.scrollTrigger`, only available while the animation is
// still live (a reconstructed instance never had one attached).
export function scrollTriggerConfig(node) {
  const st = node.ref?.scrollTrigger;
  if (!st) return null;
  return {
    trigger: selectorGuess([st.trigger]),
    start: st.start,
    end: st.end,
    scrub: !!st.vars?.scrub,
    toggleActions: st.vars?.toggleActions || null,
    markers: st.vars?.markers ?? false,
  };
}

const SKIP_KEYS = new Set([
  'id', 'data', 'yoyo', 'repeat', 'repeatDelay', 'delay', 'scrollTrigger', 'startAt', 'runBackwards', 'paused', 'parent', 'overwrite',
  'onStart', 'onStartParams', 'onUpdate', 'onUpdateParams', 'onComplete', 'onCompleteParams',
  'onRepeat', 'onRepeatParams', 'onReverseComplete', 'onReverseCompleteParams',
]);

export function methodGuess(vars) {
  if (vars.runBackwards) return 'from';
  if (vars.startAt) return 'fromTo';
  return 'to';
}

// A matchMedia()-scoped animation carries the Context that was active when
// it was created via `_ctx` (set once, in the Animation constructor). Only
// the per-condition Context that MatchMedia.add() builds carries `.queries`
// (the raw media-query strings) alongside `.conditions` (which currently
// match); that's what distinguishes a matchMedia context from an unrelated
// gsap.context() or no context at all. detect.js snapshots this onto the
// node while the instance is live (see matchMediaSnapshot there), so unlike
// scrollTriggerConfig above it survives reconstruction; the live `_ctx`
// read is kept as a fallback.
export function matchMediaConfig(node) {
  if (node.matchMedia) return node.matchMedia;
  const ctx = node.ref?._ctx;
  if (!ctx?.queries) return null;
  return { queries: ctx.queries, conditions: ctx.conditions || {} };
}

// Turns a raw media-query string into a plain-English viewport range
// ("≥768px", "<1024px", "768px–1023px") by pulling out its min/max-width
// terms. Queries that carry no width term at all (prefers-reduced-motion,
// orientation, hover, or gsap.matchMedia()'s implicit "all") aren't tied to
// a viewport size, so callers should treat a `null` return as "default
// behaviour" rather than as a breakpoint.
export function viewportLabel(query) {
  if (!query) return null;
  const min = query.match(/min-width:\s*([\d.]+)(px|em|rem)/);
  const max = query.match(/max-width:\s*([\d.]+)(px|em|rem)/);
  if (!min && !max) return null;
  if (min && max) return `${min[1]}${min[2]}–${max[1]}${max[2]}`;
  if (min) return `≥${min[1]}${min[2]}`;
  return `<${max[1]}${max[2]}`;
}

function formatValue(v) {
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'function') return '/* function */';
  if (v && typeof v === 'object') {
    try {
      return JSON.stringify(v);
    } catch {
      return '{ … }';
    }
  }
  return String(v);
}

// Builds the bare expression (no trailing `;`) so a timeline embedded as
// another timeline's child via .add() doesn't leak a statement-terminating
// semicolon into the middle of that call — jsSnippet below adds the `;`
// only once, at the true top level.
function jsExpr(node, indent) {
  if (node.type === 'timeline') {
    const opts = [];
    if (node.repeat) opts.push(`repeat: ${node.repeat}`);
    if (node.delay) opts.push(`delay: ${node.delay}`);
    const head = `${indent}gsap.timeline({ id: "${node.label}"${opts.length ? ', ' + opts.join(', ') : ''} })`;
    const addIndent = `${indent}  `;
    // jsExpr(c, '') returns text starting at column 0; everything after its
    // first line needs addIndent prepended too, or a multi-line child (e.g.
    // a tween's vars object) reads flush against the margin instead of
    // nested under its .add( call — the JS mirror of format-css.js's
    // depth-aware indenting for nested CSS blocks.
    const children = (node.children || []).map((c) => {
      const lines = jsExpr(c, '').split('\n');
      const text = lines.map((line, i) => (i === 0 ? line : addIndent + line)).join('\n');
      return `${addIndent}.add(${text}, ${c.start})`;
    });
    return children.length ? `${head}\n${children.join('\n')}` : head;
  }

  const method = methodGuess(node.vars || {});
  const sel = selectorGuess(node.targets) || '<selector>';
  const lines = Object.entries(node.vars || {})
    .filter(([k]) => !SKIP_KEYS.has(k))
    .map(([k, v]) => `  ${k}: ${formatValue(v)},`);
  lines.push(`  duration: ${node.duration},`);
  if (node.repeat) lines.push(`  repeat: ${node.repeat},`);
  if (node.yoyo) lines.push(`  yoyo: true,`);
  if (node.delay) lines.push(`  delay: ${node.delay},`);
  return `${indent}gsap.${method}(${JSON.stringify(sel)}, {\n${lines.join('\n')}\n${indent}})`;
}

export function jsSnippet(node, indent = '') {
  const expr = jsExpr(node, indent);
  return node.type === 'timeline' ? `${expr};` : expr;
}

// ---- matchMedia context for the Code panel ----------------------------------
//
// When a node was created inside gsap.matchMedia() (see matchMediaConfig
// above), the Code panel should show that context rather than pretending the
// call is unconditional: a reconstructed snippet is wrapped back in the
// mm.add() call it would have been authored in, and real page-source text
// (which is just the inner call, located mid-file) gets a comment header
// naming the queries instead, since wrapping someone's real text in code
// they didn't write would stop being honest.

const activeWord = (active) => (active ? 'active' : 'inactive');

// True when gsap generated the condition name itself from the string form of
// mm.add("(query)", fn): gsap stores that as { matches: "(query)" } (see
// MatchMedia.add in gsap-core), so the name carries no authored meaning.
export const isGeneratedConditionName = (name, query) => name === query || name === 'matches';

// One human line per query: `desktop: "(min-width: 768px)" — ≥768px (active)`.
// The condition name is skipped when gsap generated it from the string form
// of mm.add() (see isGeneratedConditionName above).
export function matchMediaLines(mm) {
  return Object.entries(mm.queries).map(([name, query]) => {
    const range = viewportLabel(query);
    const label = isGeneratedConditionName(name, query) ? JSON.stringify(query) : `${name}: ${JSON.stringify(query)}`;
    return `${label}${range ? ` — ${range}` : ''} (${activeWord(!!mm.conditions[name])})`;
  });
}

export function matchMediaComment(mm) {
  const lines = matchMediaLines(mm);
  if (lines.length === 1) return `/* inside gsap.matchMedia() — ${lines[0]} */`;
  return `/* inside gsap.matchMedia():\n${lines.map((l) => `   ${l}`).join('\n')} */`;
}

const indentLines = (text) => text.split('\n').map((l) => (l ? `  ${l}` : l)).join('\n');

// Rebuilds the mm.add() shape around a reconstructed snippet: the string form
// when the context has a single query whose name is the query itself (what
// gsap.matchMedia().add("(min-width: 768px)", fn) produces), the object
// (named-conditions) form otherwise.
export function wrapInMatchMedia(code, mm) {
  const entries = Object.entries(mm.queries || {});
  if (!entries.length) return code;
  const body = indentLines(code);
  if (entries.length === 1 && isGeneratedConditionName(entries[0][0], entries[0][1])) {
    return `gsap.matchMedia().add(${JSON.stringify(entries[0][1])}, () => {\n${body}\n});`;
  }
  const conds = entries.map(([name, query]) => `  ${name}: ${JSON.stringify(query)},`).join('\n');
  return `gsap.matchMedia().add({\n${conds}\n}, (context) => {\n${body}\n});`;
}
