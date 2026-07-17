// Best-effort file:line location for a CSS rule, the CSS-world mirror of
// source.js's JS lookup. The CSSOM tells you a rule's parsed cssText and
// which CSSStyleSheet it came from, but never a source line, browsers just
// don't expose that. So the same-origin stylesheet's own text is fetched
// (same technique as source.js's script fetch, minus the import crawl:
// there's only ever one file to look in per rule) and the rule's text is
// located inside it by a plain string search.
//
// Vite's dev server serves CSS as JS-injected <style> elements (HMR),
// stylesheet.href is null for those even though the CSS really did come
// from a real .css file on disk; ownerNode.dataset.viteDevId carries that
// original, same-origin-servable path, so that's tried as a fallback
// fetch URL. Anything else (a CSS-in-JS runtime, an inline <style> with
// neither, a cross-origin sheet) has no locatable source, callers get a
// cssText but no {url, line}, same honest fallback as everywhere else in
// this codebase.
//
// Fetching that same-origin path back in dev doesn't return the raw .css
// file, though: Vite's dev server hands back the *module* it generated for
// it — `const __vite__css = "...whole file, one JS string, \n escaped..."`
// — never the file's own text with real line breaks. Locating a needle in
// that string still works (indexOf doesn't care), but every match then
// resolves to line ~3 (the module's own line 3, where that giant string
// literal lives), regardless of where the rule actually is in the source
// file. unwrapViteCssModule pulls the string literal back out and
// JSON-unescapes it (safe: Vite builds it via JSON.stringify) to recover
// the original text, real newlines included, before any line is counted.

import { formatCssText } from './format-css.js';
import { allowedOrigins } from './source.js';

const VITE_CSS_MODULE_RE = /\b__vite__css\s*=\s*("(?:[^"\\]|\\.)*")/;

function unwrapViteCssModule(text) {
  const m = VITE_CSS_MODULE_RE.exec(text);
  if (!m) return text;
  try {
    return JSON.parse(m[1]);
  } catch {
    return text;
  }
}

const fileCache = new Map(); // url -> text | null (fetch failed/not found)

async function fetchCssText(url) {
  if (fileCache.has(url)) return fileCache.get(url);
  let text = null;
  try {
    const res = await fetch(url);
    if (res.ok) text = unwrapViteCssModule(await res.text());
  } catch {}
  fileCache.set(url, text);
  return text;
}

function sourceUrlFor(sheet) {
  if (sheet.href) {
    try {
      const u = new URL(sheet.href, location.href);
      return allowedOrigins().has(u.origin) ? u.href : null;
    } catch {
      return null;
    }
  }
  const viteId = sheet.ownerNode?.dataset?.viteDevId;
  if (viteId) {
    try {
      return new URL(viteId, location.href).href;
    } catch {
      return null;
    }
  }
  return null;
}

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

// Locates `needle` (a distinctive substring of the rule, e.g. "@keyframes
// name" or "selector {") inside `sheetUrl`'s fetched text and returns its
// line number, or null if the sheet isn't fetchable or doesn't contain it.
async function locateInSheet(sheetUrl, needle) {
  const text = await fetchCssText(sheetUrl);
  if (!text) return null;
  const idx = text.indexOf(needle);
  return idx === -1 ? null : lineOf(text, idx);
}

// Walks every same-origin/reachable stylesheet (recursing into
// @media/@supports/@layer grouping rules), same shape as describe-css.js's
// keyframesRuleText, but returns the owning sheet alongside the rule so its
// source can be located, and can also match a plain CSSStyleRule via a
// predicate instead of only @keyframes by name.
//
// Returns the *first* match by default (used for @keyframes, where a name
// is unique enough that "first" and "only" are the same thing), or the
// *last* when `preferLast` is set — for a plain selector predicate, a
// generic reset rule (`*`, `body`) tends to appear early in a stylesheet
// and match everything, so the later, more specific rule that would
// actually win the cascade is a far more useful "styling context" to show.
function walkRules(predicate, { preferLast = false } = {}) {
  let found = null;
  for (const sheet of document.styleSheets) {
    let rules;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // cross-origin, not readable
    }
    const stack = [...rules];
    while (stack.length) {
      const rule = stack.shift();
      if (predicate(rule)) {
        found = { rule, sheet };
        if (!preferLast) return found;
      }
      if (rule.cssRules) stack.push(...rule.cssRules);
    }
  }
  return found;
}

// {url, line} for the authored `@keyframes name { ... }` rule, or null if
// it can't be found or its sheet isn't fetchable/same-origin.
export async function findKeyframesSource(name) {
  if (!name) return null;
  const found = walkRules((r) => typeof CSSKeyframesRule !== 'undefined' && r instanceof CSSKeyframesRule && r.name === name);
  if (!found) return null;
  const url = sourceUrlFor(found.sheet);
  if (!url) return null;
  const line = await locateInSheet(url, `@keyframes ${name}`) ?? (await locateInSheet(url, `@keyframes${name}`));
  return line ? { url, line } : null;
}

// {url, line, cssText} for the first authored stylesheet rule matching `el`
// (base styling context for a GSAP-animated element, which doesn't author
// stylesheet rules of its own the way a CSS animation/transition does), or
// null if nothing matches or its sheet isn't fetchable.
export async function findMatchedRuleSource(el) {
  if (!el || typeof el.matches !== 'function') return null;
  const found = walkRules(
    (r) => typeof CSSStyleRule !== 'undefined' && r instanceof CSSStyleRule && safeMatches(el, r.selectorText),
    { preferLast: true }
  );
  if (!found) return null;
  const url = sourceUrlFor(found.sheet);
  if (!url) return null;
  const line = await locateInSheet(url, found.rule.selectorText);
  return line ? { url, line, cssText: formatCssText(found.rule.cssText) } : null;
}

function safeMatches(el, selector) {
  try {
    return el.matches(selector);
  } catch {
    return false; // a selector the browser can't evaluate (e.g. a nesting/vendor form)
  }
}
