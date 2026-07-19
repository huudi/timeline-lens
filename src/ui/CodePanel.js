// Code panel: three collapsible sections per detected animation — the HTML
// of its target element, the CSS driving it (or styling it, for a GSAP
// tween), and the JS call that created it — each labeled with a file:line
// location when one could be found, falling back honestly to a
// reconstructed/best-effort synthesis otherwise (see source.js, css-source.js,
// html-source.js). Read-only throughout: nothing here is exported, diffed,
// or writable, since there's nothing to write it back into (the studio
// doesn't author anything).

import { html } from 'htm/preact';
import { useEffect, useState } from 'preact/hooks';
import { selectedId, findNode, codeWidth, setCodeWidth } from '../store.js';
import { jsSnippet, matchMediaConfig, matchMediaComment, wrapInMatchMedia } from '../describe.js';
import { cssCode, elementCssText } from '../describe-css.js';
import { formatJsText } from '../format-js.js';
import { findSource, findAnimateSource } from '../source.js';
import { findKeyframesSource, findMatchedRuleSource } from '../css-source.js';
import { findHtmlSource, openingTagSnippet } from '../html-source.js';
import { callSiteFor } from '../motion-ref.js';
import { HResizeHandle, ChevronRightIcon, ChevronDownIcon } from './util.js';

function fileName(url) {
  try {
    return new URL(url).pathname.split('/').pop() || url;
  } catch {
    return url;
  }
}

// First real target element belonging to `node`, walking into a group's
// children (a css-animation/css-transition group, or a gsap timeline) since
// the group itself carries no targets of its own.
function primaryTarget(node) {
  if (node.type === 'tween') return node.targets?.[0] || null;
  const stack = [...(node.children || [])];
  while (stack.length) {
    const n = stack.shift();
    if (n.type === 'tween' && n.targets?.[0]) return n.targets[0];
    stack.push(...(n.children || []));
  }
  return null;
}

// `info` is one of the resolve*() results below: { note } for a plain
// explanatory line (nothing to show as code), or { text, loc?, varName? }
// for an actual snippet, optionally located to a file:line and/or an
// authored variable name.
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return html`
    <button
      class="gts-code-copy"
      title="Copy to clipboard"
      onClick=${(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }, () => {}); // permission denial etc. — button just stays "Copy"
      }}
    >
      ${copied ? 'Copied' : 'Copy'}
    </button>
  `;
}

function CodeSection({ title, open, onToggle, info }) {
  const status = info === undefined ? 'searching…' : info.status;
  return html`
    <div class="gts-code-section">
      <button class="gts-code-section-head" onClick=${onToggle}>
        <span class="gts-code-chevron">${open ? html`<${ChevronDownIcon} />` : html`<${ChevronRightIcon} />`}</span>
        <span class="gts-code-section-title">${title}</span>
        ${status ? html`<small>${status}</small>` : null}
      </button>
      ${open
        ? html`<div class="gts-code-section-body">
            ${info?.loc ? html`<div class="gts-code-loc">${fileName(info.loc.url)}:${info.loc.line}</div>` : null}
            ${info?.varName ? html`<div class="gts-code-var">variable: <code>${info.varName}</code></div>` : null}
            ${info?.note
              ? html`<div class="gts-note">${info.note}</div>`
              : html`<div class="gts-code-pre-wrap">
                  <${CopyButton} text=${info?.text ?? ''} />
                  <pre class="gts-code-pre">${info?.text ?? '…'}</pre>
                </div>`}
          </div>`
        : null}
    </div>
  `;
}

// Resolves the JS section's content for a single node: gsap keeps the
// original findSource/jsSnippet behavior; waapi/motion leaves prefer an
// exact call-site captured live by motion-ref.js's Element.prototype.animate
// wrap over source.js's regex-found text, over a synthetic reconstruction;
// css-animation/css-transition have no JS call to show at all. Text found in
// page source is run through formatJsText first — source.js captures it
// verbatim, which may be a single unbroken physical line, the JS mirror of
// why resolveCss below runs stylesheet text through formatCssText.
async function resolveJs(node) {
  if (node.engine === 'css-animation' || node.engine === 'css-transition') {
    return { note: 'Declarative — driven entirely by CSS, no JS call authored it. See the CSS tab.', status: 'no JS call' };
  }
  if (node.engine === 'waapi' || node.engine === 'motion') {
    const stackLoc = node.ref ? callSiteFor(node.ref) : null;
    const found = await findAnimateSource(node);
    const loc = stackLoc || (found ? { url: found.url, line: found.line } : null);
    if (found) return { text: formatJsText(found.text), loc, status: 'from page source' };
    if (stackLoc) return { text: cssCode(node).text, loc: stackLoc, status: 'location from the call stack, exact source text not matched' };
    return { text: cssCode(node).text, loc: null, status: 'reconstructed, not found in page scripts' };
  }
  // gsap. A matchMedia()-scoped node carries its Context while live (see
  // describe.js): real page-source text gets a comment header naming the
  // queries (the located text is just the inner call), a reconstructed
  // snippet is wrapped back in the mm.add() call it was authored in.
  const mm = matchMediaConfig(node);
  const found = await findSource(node);
  if (found) {
    const text = formatJsText(found.text);
    return {
      text: mm ? `${matchMediaComment(mm)}\n${text}` : text,
      loc: { url: found.url, line: found.line },
      varName: found.varName,
      status: 'from page source',
    };
  }
  const snippet = jsSnippet(node);
  return {
    text: mm ? wrapInMatchMedia(snippet, mm) : snippet,
    loc: null,
    status: 'reconstructed, not found in page scripts',
  };
}

// Resolves the CSS section's content. Every engine gets the target element's
// complete authored styling via elementCssText (see describe-css.js): every
// stylesheet rule matching the element, including its pseudo-element
// (::before/::after) and state (:hover/...) rules, each re-wrapped in the
// @media/@supports/@layer context it was authored under — as opposed to just
// the single most specific base rule. css-animation/css-transition
// additionally show their authored/synthesized animation rule first, with a
// file:line location for the @keyframes case (a css-transition isn't backed
// by any one stylesheet rule, so that part has text but no location);
// waapi/motion have no animation CSS to show (they're driven by a JS
// element.animate() call — see the JS tab) but still get the element's
// rules; same for gsap, which doesn't author stylesheet rules itself. The
// location line still comes from findMatchedRuleSource/findKeyframesSource
// (the fetch-based lookups), pointing at the animation rule when there is
// one and the element's cascade-winning rule otherwise.
async function resolveCss(node, target) {
  const elementCss = elementCssText(target);
  const elementLoc = elementCss ? await findMatchedRuleSource(target) : null;

  if (node.engine === 'css-animation' || node.engine === 'css-transition') {
    const { text: animText, real } = cssCode(node);
    const name = node.type === 'timeline' ? node.label : node.name;
    const animLoc = node.engine === 'css-animation' ? await findKeyframesSource(name) : null;
    const text = elementCss ? `${animText}\n\n/* element styling */\n${elementCss}` : animText;
    const loc = animLoc || (elementLoc ? { url: elementLoc.url, line: elementLoc.line } : null);
    return { text, loc, status: animLoc ? 'from page stylesheets' : real ? 'from page stylesheets' : 'reconstructed, a best-effort synthesis' };
  }

  if (node.engine === 'waapi' || node.engine === 'motion') {
    if (elementCss) {
      return {
        text: elementCss,
        loc: elementLoc ? { url: elementLoc.url, line: elementLoc.line } : null,
        status: 'from page stylesheets (element styling only — the animation itself is driven by a JS element.animate() call, see the JS tab)',
      };
    }
    return { note: 'No matching stylesheet rule found for this element. The animation itself is not CSS-authored — driven by a JS element.animate() call. See the JS tab.', status: 'no stylesheet rule' };
  }

  if (elementCss) {
    return {
      text: elementCss,
      loc: elementLoc ? { url: elementLoc.url, line: elementLoc.line } : null,
      status: 'from page stylesheets',
    };
  }
  return { note: 'No matching stylesheet rule found for this element.', status: 'none found' };
}

async function resolveHtml(target) {
  if (!target) return { note: 'No target element.', status: 'n/a' };
  if (typeof Element === 'undefined' || !(target instanceof Element)) {
    return { note: 'Target is a plain JS object, not a DOM element — no HTML to show.', status: 'not a DOM element' };
  }
  const loc = await findHtmlSource(target);
  return { text: openingTagSnippet(target), loc, status: loc ? 'from page source' : 'reconstructed from the live DOM' };
}

export function CodePanel() {
  const node = findNode(selectedId.value);
  // Captured once per render (i.e. once per drag gesture, see HResizeHandle/
  // App.js's ResizeHandle for the same pattern applied to panel height):
  // onDrag must add its delta to the width as it was when THIS drag
  // started, not to the live signal, which setCodeWidth is itself updating
  // on every intermediate pointermove — reading the live value back would
  // compound the delta across every step of the drag instead of applying it
  // once.
  const startWidth = codeWidth.value;
  const [jsOpen, setJsOpen] = useState(true);
  const [cssOpen, setCssOpen] = useState(false);
  const [htmlOpen, setHtmlOpen] = useState(false);
  const [js, setJs] = useState(undefined);
  const [css, setCss] = useState(undefined);
  const [htmlInfo, setHtmlInfo] = useState(undefined);

  useEffect(() => {
    setJs(undefined);
    setCss(undefined);
    setHtmlInfo(undefined);
    if (!node) return;
    let cancelled = false;
    const target = primaryTarget(node);
    resolveJs(node).then((r) => !cancelled && setJs(r));
    resolveCss(node, target).then((r) => !cancelled && setCss(r));
    resolveHtml(target).then((r) => !cancelled && setHtmlInfo(r));
    return () => {
      cancelled = true;
    };
  }, [node?.id]);

  return html`
    <div class="gts-code" style="width:${codeWidth.value}px">
      <${HResizeHandle} onDrag=${(dx) => setCodeWidth(startWidth + dx)} />
      <div class="gts-props-head">Code</div>
      ${!node
        ? html`<div class="gts-note">Select an animation to view its source.</div>`
        : html`
            <${CodeSection} title="HTML" open=${htmlOpen} onToggle=${() => setHtmlOpen(!htmlOpen)} info=${htmlInfo} />
            <${CodeSection} title="CSS" open=${cssOpen} onToggle=${() => setCssOpen(!cssOpen)} info=${css} />
            <${CodeSection} title="JS" open=${jsOpen} onToggle=${() => setJsOpen(!jsOpen)} info=${js} />
          `}
    </div>
  `;
}
