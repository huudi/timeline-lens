// Best-effort, read-only inspection helpers for CSS/WAAPI nodes in the Code
// panel: the CSS mirror of describe.js + source.js. For a CSS animation the
// authored @keyframes rule is recovered verbatim from the page's own
// stylesheets when possible (real text, not a guess); everything else falls
// back to a synthesis from the snapshot keyframes. Purely informational,
// same as the GSAP side: nothing to copy back, no diffing, no export.

import { keyframeProps } from './detect-css.js';
import { formatCssText } from './format-css.js';

const kebab = (s) => (s.startsWith('--') ? s : s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`));

// ---- stylesheet walking, condition-aware -----------------------------------
//
// One shared walk over every readable stylesheet rule, carrying the stack of
// grouping conditions (@media/@supports/@layer) each rule is nested under, so
// a rule found inside `@media (min-width: 768px)` is reported *with* that
// context instead of stripped of it. CSSKeyframesRule's own cssRules are the
// keyframe percentage blocks, not style rules, so the walk doesn't descend
// into those.

function ruleCondition(rule) {
  if (typeof CSSMediaRule !== 'undefined' && rule instanceof CSSMediaRule) {
    return `@media ${rule.conditionText ?? rule.media.mediaText}`;
  }
  if (typeof CSSSupportsRule !== 'undefined' && rule instanceof CSSSupportsRule) {
    return `@supports ${rule.conditionText}`;
  }
  if (typeof CSSLayerBlockRule !== 'undefined' && rule instanceof CSSLayerBlockRule) {
    return `@layer ${rule.name}`;
  }
  return null;
}

// visit(rule, conditions, sheet) — return true to stop the whole walk.
function walkAllRules(visit) {
  if (typeof document === 'undefined') return;
  for (const sheet of document.styleSheets) {
    let rules;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // cross-origin stylesheet, not readable, move on
    }
    if (walkList(rules, [], visit, sheet)) return;
  }
}

function walkList(rules, conditions, visit, sheet) {
  for (const rule of rules) {
    if (visit(rule, conditions, sheet)) return true;
    if (typeof CSSKeyframesRule !== 'undefined' && rule instanceof CSSKeyframesRule) continue;
    if (rule.cssRules) {
      const cond = ruleCondition(rule);
      if (walkList(rule.cssRules, cond ? [...conditions, cond] : conditions, visit, sheet)) return true;
    }
  }
  return false;
}

// A rule's @media conditions decide whether it applies at the current
// viewport; @supports/@layer wrappers are context, not viewport-dependent.
function conditionsActive(conditions) {
  for (const cond of conditions) {
    if (!cond.startsWith('@media ')) continue;
    try {
      if (!matchMedia(cond.slice('@media '.length)).matches) return false;
    } catch {}
  }
  return true;
}

const indentText = (text) => text.split('\n').map((l) => (l ? `  ${l}` : l)).join('\n');

// Re-wraps a formatted rule in the grouping at-rules it was authored under,
// annotating @media wrappers that don't match the current viewport, so the
// Code panel shows the rule in its real context instead of pretending it's
// unconditional.
function wrapInConditions(text, conditions) {
  let out = text;
  for (let i = conditions.length - 1; i >= 0; i--) {
    const cond = conditions[i];
    let head = `${cond} {`;
    if (cond.startsWith('@media ')) {
      let matches = true;
      try {
        matches = matchMedia(cond.slice('@media '.length)).matches;
      } catch {}
      if (!matches) head += ' /* inactive at current viewport */';
    }
    out = `${head}\n${indentText(out)}\n}`;
  }
  return out;
}

// Finds the authored @keyframes rule for `name` by walking every same-origin
// stylesheet (cross-origin sheets throw on .cssRules and are skipped, same
// caveat as source.js's script scan), recursing into grouping rules so a
// rule nested under @media/@supports/@layer is still found — and wrapping
// the result back in those grouping rules so the @media context is shown.
//
// A name can be declared more than once (e.g. an @media-scoped override that
// swaps the rule across a breakpoint), every declaration is returned, not
// just the first hit.
export function keyframesRuleText(name) {
  if (typeof document === 'undefined' || !name) return null;
  const blocks = [];
  walkAllRules((rule, conditions) => {
    if (typeof CSSKeyframesRule !== 'undefined' && rule instanceof CSSKeyframesRule && rule.name === name) {
      blocks.push(wrapInConditions(formatCssText(rule.cssText), conditions));
    }
    return false;
  });
  return blocks.length ? blocks.join('\n\n') : null;
}

// The @media/@supports/@layer conditions the authored @keyframes rule(s) for
// `name` sit under, for the Properties panel's Match media section: one array
// of condition strings per declaration found, [] meaning unconditional.
export function keyframesConditions(name) {
  if (typeof document === 'undefined' || !name) return [];
  const found = [];
  walkAllRules((rule, conditions) => {
    if (typeof CSSKeyframesRule !== 'undefined' && rule instanceof CSSKeyframesRule && rule.name === name) {
      found.push({ conditions: [...conditions], active: conditionsActive(conditions) });
    }
    return false;
  });
  return found;
}

// ---- element rule collection ------------------------------------------------
//
// Every authored stylesheet rule that styles `el`, including rules that only
// apply to one of its pseudo-elements (::before/::after/...), one of its
// interaction states (:hover/:focus/...), or only inside an @media block. A
// pseudo-element/state selector never matches el.matches() as-authored, so
// each comma-separated selector is retried with those trailing parts stripped
// ("button.card:hover::after" tests as "button.card"); :not()/:is()/
// structural pseudo-classes are left intact since stripping them would change
// which elements the selector means.

const PSEUDO_ELEMENT_RE = /::(?:before|after|first-line|first-letter|marker|placeholder|selection|backdrop|file-selector-button)\b/g;
// legacy single-colon pseudo-element forms + interaction/state pseudo-classes
const STATE_PSEUDO_RE = /:(?:before|after|hover|focus-within|focus-visible|focus|active|visited|link|checked|disabled|enabled|placeholder-shown|target)\b/g;

function baseSelector(sel) {
  return sel.replace(PSEUDO_ELEMENT_RE, '').replace(STATE_PSEUDO_RE, '').trim();
}

function safeMatchesSel(el, selector) {
  if (!selector) return false;
  try {
    return el.matches(selector);
  } catch {
    return false; // a selector the browser can't evaluate (nesting/vendor form)
  }
}

function selectorAppliesTo(el, selectorText) {
  for (const part of (selectorText || '').split(',')) {
    const sel = part.trim();
    if (!sel) continue;
    if (safeMatchesSel(el, sel)) return true;
    const base = baseSelector(sel);
    if (base !== sel && !/[>+~\s]$/.test(base) && safeMatchesSel(el, base)) return true;
  }
  return false;
}

const MAX_ELEMENT_RULES = 40;

// A bare universal rule (`* { box-sizing: border-box; margin: 0; ... }`,
// `*, *::before, *::after`) matches literally every element, so it would
// show up as "element styling" on every single node — it's a page-wide
// reset, not styling authored for this element. Only selectors whose every
// comma part is a universal form are dropped; `*, .card` still counts as
// styling the element.
const UNIVERSAL_PART_RE = /^\*?(::?[a-zA-Z-]+(\([^)]*\))?)?$/;

function isUniversalSelector(selectorText) {
  const parts = (selectorText || '').split(',').map((s) => s.trim()).filter(Boolean);
  return parts.length > 0 && parts.every((sel) => UNIVERSAL_PART_RE.test(sel));
}

// [{ rule, conditions, active }] for every readable stylesheet rule matching
// `el` (directly, or via a pseudo-element/state form of its selector), in
// document order. Capped so a pathological page (thousands of matching
// utility rules) can't stall the panel. Global resets (see
// isUniversalSelector above) are skipped.
export function collectElementRules(el) {
  if (!el || typeof el.matches !== 'function') return [];
  const found = [];
  walkAllRules((rule, conditions, sheet) => {
    if (
      typeof CSSStyleRule !== 'undefined' &&
      rule instanceof CSSStyleRule &&
      !isUniversalSelector(rule.selectorText) &&
      selectorAppliesTo(el, rule.selectorText)
    ) {
      found.push({ rule, conditions: [...conditions], active: conditionsActive(conditions), sheet });
    }
    return found.length >= MAX_ELEMENT_RULES;
  });
  return found;
}

// Every @media/@supports/@layer scope that gates the CSS animation `name` on
// `el` — whether the @keyframes rule itself is declared inside the at-rule,
// or (the more common authoring shape) the keyframes are global and only the
// `animation:`/`animation-name:` *assignment* on the element is
// breakpoint-scoped. Deduped; [] means the animation is unconditional.
export function animationConditions(name, el) {
  const found = keyframesConditions(name).filter((d) => d.conditions.length);
  if (el) {
    for (const { rule, conditions, active } of collectElementRules(el)) {
      if (!conditions.length) continue;
      const names = rule.style?.animationName || rule.style?.getPropertyValue?.('animation-name') || '';
      if (names.split(',').some((n) => n.trim() === name)) found.push({ conditions, active });
    }
  }
  const seen = new Set();
  return found.filter((d) => {
    const key = d.conditions.join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// The Code panel text for everything above: each matching rule formatted and
// re-wrapped in its authored @media/@supports/@layer context, joined in
// document order. Null when nothing matches.
export function elementCssText(el) {
  const found = collectElementRules(el);
  if (!found.length) return null;
  return found.map(({ rule, conditions }) => wrapInConditions(formatCssText(rule.cssText), conditions)).join('\n\n');
}

const KEYFRAME_META = new Set(['offset', 'computedOffset', 'easing', 'composite']);

function keyframeBody(kf, indent) {
  return Object.entries(kf)
    .filter(([k, v]) => !KEYFRAME_META.has(k) && typeof v !== 'function' && v != null)
    .map(([k, v]) => `${indent}${kebab(k)}: ${v};`)
    .join('\n');
}

function offsetPct(kf, i, total) {
  const offset = kf.computedOffset ?? kf.offset ?? (total > 1 ? i / (total - 1) : 1);
  return `${Math.round(offset * 1000) / 10}%`;
}

// Synthetic @keyframes from the snapshot, used when the authored rule can't
// be recovered (cross-origin sheet, or the keyframes only ever existed in JS).
export function syntheticKeyframes(name, keyframes) {
  const blocks = (keyframes || []).map((kf, i) => `  ${offsetPct(kf, i, keyframes.length)} {\n${keyframeBody(kf, '    ')}\n  }`);
  return `@keyframes ${name} {\n${blocks.join('\n')}\n}`;
}

function animationShorthand(node) {
  const parts = [
    node.name,
    node.progressDomain ? 'auto' : `${node.duration}s`,
    node.easing !== 'linear' ? node.easing : null,
    node.delay ? `${node.delay}s` : null,
    node.repeat === -1 ? 'infinite' : node.repeat ? `${node.repeat + 1}` : null,
    node.direction !== 'normal' ? node.direction : null,
    node.fill !== 'none' ? node.fill : null,
  ].filter(Boolean);
  return `animation: ${parts.join(' ')};`;
}

function selectorGuess(node) {
  const el = node.targets?.[0];
  if (!el || typeof Element === 'undefined' || !(el instanceof Element)) return '<selector>';
  const base = el.id ? `#${el.id}` : el.classList.length ? `.${el.classList[0]}` : el.tagName.toLowerCase();
  return base + (node.pseudoElement || '');
}

function transitionSnippet(node) {
  const leaves = node.type === 'timeline' ? node.children : [node];
  const props = leaves.map((leaf) => `${kebab(leaf.property || 'all')} ${leaf.duration}s${leaf.easing !== 'linear' ? ` ${leaf.easing}` : ''}${leaf.delay ? ` ${leaf.delay}s` : ''}`);
  const lines = [`${selectorGuess(leaves[0] || node)} {`, `  transition: ${props.join(', ')};`, `}`];
  const changes = leaves
    .filter((leaf) => leaf.keyframes?.length >= 2)
    .map((leaf) => {
      const prop = keyframeProps(leaf.keyframes)[0];
      if (!prop) return null;
      return `/* ${kebab(prop)}: ${leaf.keyframes[0][prop]} → ${leaf.keyframes[leaf.keyframes.length - 1][prop]} */`;
    })
    .filter(Boolean);
  return [...lines, '', ...changes].join('\n');
}

function formatFrame(kf) {
  const entries = Object.entries(kf)
    .filter(([k, v]) => k !== 'computedOffset' && typeof v !== 'function' && v != null)
    .map(([k, v]) => `${k}: ${typeof v === 'string' ? JSON.stringify(v) : v}`);
  return `  { ${entries.join(', ')} }`;
}

function waapiSnippet(node) {
  const opts = [];
  if (node.label && node.label !== selectorGuess(node).slice(1)) opts.push(`id: ${JSON.stringify(node.label)}`);
  opts.push(`duration: ${Math.round(node.duration * 1000)}`);
  if (node.delay) opts.push(`delay: ${Math.round(node.delay * 1000)}`);
  if (node.repeat) opts.push(`iterations: ${node.repeat === -1 ? 'Infinity' : node.repeat + 1}`);
  if (node.direction !== 'normal') opts.push(`direction: ${JSON.stringify(node.direction)}`);
  if (node.easing !== 'linear') opts.push(`easing: ${JSON.stringify(node.easing)}`);
  if (node.fill !== 'none') opts.push(`fill: ${JSON.stringify(node.fill)}`);
  const frames = (node.keyframes || []).map(formatFrame).join(',\n');
  return `document.querySelector(${JSON.stringify(selectorGuess(node))}).animate([\n${frames}\n], {\n  ${opts.join(',\n  ')}\n});`;
}

// The Code panel's one entry point for non-GSAP nodes: returns the text to
// show plus whether it's real authored source (from a page stylesheet) or a
// synthesis from the detection snapshot.
export function cssCode(node) {
  if (node.engine === 'css-transition') {
    return { text: transitionSnippet(node), real: false };
  }
  if (node.engine === 'waapi' || node.engine === 'motion') {
    return { text: waapiSnippet(node), real: false };
  }
  // css-animation: group node or leaf, either way the rule is keyed by name
  const leaf = node.type === 'timeline' ? node.children[0] : node;
  const name = node.type === 'timeline' ? node.label : node.name;
  const authored = keyframesRuleText(name);
  if (authored) {
    return { text: `/* ${animationShorthand({ ...leaf, name })} */\n\n${authored}`, real: true };
  }
  if (!leaf?.keyframes?.length) return { text: `/* @keyframes ${name}: keyframes unavailable */`, real: false };
  return { text: `/* ${animationShorthand({ ...leaf, name })} */\n\n${syntheticKeyframes(name, leaf.keyframes)}`, real: false };
}
