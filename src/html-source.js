// Best-effort file:line location for a detected animation's target element,
// the markup-world mirror of source.js/css-source.js. Only ever finds
// anything on a page whose HTML is literally served as static text (see
// apps/test-site-global, no bundler): a React/Next host's real markup is
// JSX that never exists as HTML source text at all, so there's nothing to
// find there, correctly falling back to "reconstructed from the live DOM"
// (real:false), the same honest fallback used everywhere in this codebase.

let cache = null; // fetched document text, or null if unfetchable
let loading = null;

async function ensureDocText() {
  if (cache !== null || loading) return loading ?? cache;
  loading = (async () => {
    try {
      const res = await fetch(location.href);
      cache = res.ok ? await res.text() : '';
    } catch {
      cache = '';
    }
    return cache;
  })();
  return loading;
}

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

// A reasonably distinctive needle for `el` within raw HTML source: its id
// attribute if it has one (near-unique by construction), else its first
// class (good enough in practice, first match wins same as source.js's
// selector fallback).
function needleFor(el) {
  if (el.id) return `id="${el.id}"`;
  if (el.classList?.length) return `class="${el.classList[0]}`; // no closing quote: also matches multi-class attrs
  return null;
}

// {url, line} for `el`'s opening tag in the page's own served HTML, or null
// if it's unfetchable, cross-origin, or (most commonly) simply doesn't
// exist as literal text (anything client-rendered).
export async function findHtmlSource(el) {
  // A gsap tween's target isn't necessarily a DOM element at all (tweening
  // a plain object's properties is common), so this guards the same way
  // css-source.js's findMatchedRuleSource does for its own el.matches check.
  if (!el || typeof document === 'undefined' || typeof Element === 'undefined' || !(el instanceof Element)) return null;
  const needle = needleFor(el);
  if (!needle) return null;
  const text = await ensureDocText();
  if (!text) return null;
  const idx = text.indexOf(needle);
  if (idx === -1) return null;
  // Back up to the start of this tag (the nearest preceding '<') so the
  // reported line is the tag's own, not wherever the attribute happened to
  // land relative to a multi-line opening tag.
  const tagStart = text.lastIndexOf('<', idx);
  return { url: location.href, line: lineOf(text, tagStart === -1 ? idx : tagStart) };
}

// A short, readable representation of `el` for display: its opening tag
// with attributes, and a child-content placeholder rather than the full
// (possibly huge) subtree — this is a debugging aid, not a serialization.
export function openingTagSnippet(el) {
  if (!el || typeof el.cloneNode !== 'function') return '';
  const clone = el.cloneNode(false);
  const open = clone.outerHTML.replace(/><\/[^>]+>$/, '>').replace(/\/>$/, '>');
  return el.childNodes.length ? `${open}…</${el.tagName.toLowerCase()}>` : open;
}
