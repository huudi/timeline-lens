// Read-only inspector for the selected animation's parameters, plugins, and
// trigger, the studio-equivalent of a devtools "computed" panel. Nothing
// here is editable; it just surfaces what detect.js/describe.js already
// read off the real instance. The Code panel (see CodePanel.js) is reserved
// for the reconstructed JS shape only.

import { html } from 'htm/preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { selectedId, findNode, propsWidth, setPropsWidth, entries } from '../store.js';
import { targetLabel } from '../detect.js';
import { detectPlugins, scrollTriggerConfig, matchMediaConfig, viewportLabel, methodGuess, isGeneratedConditionName } from '../describe.js';
import { animationConditions } from '../describe-css.js';
import { findClickTriggers } from '../source.js';
import { reactClickTriggers } from '../react-props.js';
import { liveClickTriggers } from '../click-ref.js';
import { fmt, fmtTime, visibleVarEntries, formatVarValue, ENGINE_RECON_TEXT, HResizeHandle } from './util.js';

function countTargets(node) {
  if (node.type === 'tween') return node.targets.length;
  return (node.children || []).reduce((n, c) => n + countTargets(c), 0);
}

// Every real target element a node (tween or timeline) animates, gathered
// recursively — what reactClickTriggers/liveClickTriggers need to walk each
// one's own component boundary from (see react-props.js/click-ref.js).
// Mirrors countTargets' own tween/timeline recursion just above.
function collectTargets(node) {
  if (node.type === 'tween') return node.targets || [];
  return (node.children || []).flatMap(collectTargets);
}

function Field({ label, value }) {
  return html`<div class="gts-field"><label>${label}</label><span class="gts-static">${value}</span></div>`;
}

// Click-triggered elements found by scanning the animation's own JS source
// (see source.js's findClickTriggers) — a carousel's prev/next buttons and
// nav dots, for instance. Shown alongside (not instead of) a gsap
// ScrollTrigger/CSS scroll-driven trigger, since an element can be wired up
// to more than one kind of trigger at once. `clickTriggers` is source.js's
// `{ strong, weak }` shape: `strong` from an exact `addEventListener('click',
// ...)` match, `weak` from a declared-selector variable merely handed to some
// call as a config value (e.g. a slider library's `prevEl`/`nextEl`) — real
// evidence of wiring, just not proof it's specifically a click handler, so
// it's labeled and rendered separately rather than blended into `strong`.
function ClickTriggerField({ clickTriggers }) {
  const strong = clickTriggers?.strong || [];
  const weak = clickTriggers?.weak || [];
  if (!strong.length && !weak.length) return null;
  return html`
    ${strong.length ? html`<${Field} label=${strong.length === 1 ? 'Click trigger' : 'Click triggers'} value=${strong.join(', ')} />` : null}
    ${weak.length ? html`<${Field} label="Possibly wired" value=${weak.join(', ')} />` : null}
  `;
}

const CSS_HEADS = {
  'css-animation': 'CSS Animation',
  'css-transition': 'CSS Transition',
  waapi: 'Web Animation',
  motion: 'Motion',
};

const KEYFRAME_META = new Set(['offset', 'computedOffset', 'easing', 'composite']);

function keyframeSummary(kf) {
  return Object.entries(kf)
    .filter(([k, v]) => !KEYFRAME_META.has(k) && typeof v !== 'function' && v != null)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');
}

// The Trigger section for a CSS/WAAPI node, the CSS-world equivalents of a
// ScrollTrigger: a scroll/view timeline for scroll-driven animations, or the
// property change that fired a transition. Plain time-based animations just
// say so.
function CssTrigger({ node, clickTriggers }) {
  const leaf = node.type === 'timeline' ? node.children[0] : node;
  const info = leaf?.scrollInfo;
  if (info) {
    return html`
      <${Field} label="Type" value=${info.kind === 'view' ? 'ViewTimeline (scroll-driven)' : 'ScrollTimeline (scroll-driven)'} />
      ${info.subject ? html`<${Field} label="Subject" value=${info.subject} />` : null}
      ${info.source ? html`<${Field} label="Scroller" value=${info.source} />` : null}
      ${info.axis ? html`<${Field} label="Axis" value=${info.axis} />` : null}
    `;
  }
  if (node.engine === 'css-transition') {
    const props = node.type === 'timeline' ? node.children.map((c) => c.property).filter(Boolean) : [node.property];
    return html`
      <${Field} label="Type" value="Property change" />
      <${Field} label=${props.length === 1 ? 'Property' : 'Properties'} value=${props.join(', ')} />
    `;
  }
  // waapi/motion: no scroll linkage — only a JS element.animate() call could
  // have fired it, so a click trigger found in that call's source (see
  // findClickTriggers) is the only trigger info there is to show.
  if (clickTriggers?.strong?.length || clickTriggers?.weak?.length) return html`<${ClickTriggerField} clickTriggers=${clickTriggers} />`;
  return html`<div class="gts-note">Time-based (document timeline).</div>`;
}

function CssProperties({ node, clickTriggers }) {
  const leaf = node.type === 'timeline' ? null : node;
  const targets =
    node.type === 'tween' ? node.targets.map(targetLabel).join(', ') || '—' : `${countTargets(node)} target(s)`;
  const keyframes = leaf?.keyframes || [];
  // Captured once per render/drag gesture — see CodePanel.js's identical
  // startWidth comment for why this can't just read the live signal back.
  const startWidth = propsWidth.value;

  return html`
    <div class="gts-props" style="width:${propsWidth.value}px">
      <${HResizeHandle} onDrag=${(dx) => setPropsWidth(startWidth + dx)} />
      <div class="gts-props-head">
        ${CSS_HEADS[node.engine]}${node.type === 'timeline' ? ' · group' : ''}${node.isCompleted
          ? html` · <span class="gts-recon" title=${ENGINE_RECON_TEXT[node.engine]}>reconstructed</span>`
          : ''}
      </div>
      <${Field} label="Label" value=${node.label} />
      <${Field} label="Targets" value=${targets} />
      <${Field} label="Duration" value=${fmtTime(node, node.duration)} />
      <${Field} label="Repeat" value=${node.repeat === -1 ? 'infinite' : node.repeat || 0} />
      ${leaf?.direction && leaf.direction !== 'normal' ? html`<${Field} label="Direction" value=${leaf.direction} />` : null}
      ${leaf?.fill && leaf.fill !== 'none' ? html`<${Field} label="Fill" value=${leaf.fill} />` : null}
      ${leaf?.easing && leaf.easing !== 'linear' ? html`<${Field} label="Easing" value=${leaf.easing} />` : null}
      ${node.delay ? html`<${Field} label="Delay" value=${fmt(node.delay)} />` : null}
      ${leaf?.pseudoElement ? html`<${Field} label="Pseudo-el" value=${leaf.pseudoElement} />` : null}
      ${keyframes.length
        ? html`
            <hr class="gts-sep" />
            <div class="gts-props-subhead">Keyframes</div>
            ${keyframes.map((kf, i) => {
              const offset = kf.computedOffset ?? kf.offset ?? (keyframes.length > 1 ? i / (keyframes.length - 1) : 1);
              return html`<${Field} key=${'kf-' + i} label=${`${Math.round(offset * 100)}%`} value=${keyframeSummary(kf) || '—'} />`;
            })}
          `
        : null}

      <hr class="gts-sep" />
      <div class="gts-props-subhead">Trigger</div>
      <${CssTrigger} node=${node} clickTriggers=${clickTriggers} />

      <hr class="gts-sep" />
      <div class="gts-props-subhead">Viewport</div>
      <${CssMatchMedia} node=${node} />
    </div>
  `;
}

// Which @media (or @supports/@layer) blocks gate a CSS animation — whether
// the @keyframes rule itself is declared inside one, or only the element's
// `animation:` assignment is breakpoint-scoped (see animationConditions in
// describe-css.js) — so a breakpoint-scoped animation says which viewport
// sizes it applies to, the CSS-world mirror of the gsap matchMedia section
// below. Transitions/waapi aren't backed by a named rule, and an
// unconditional rule just says so.
function CssMatchMedia({ node }) {
  const leaf = node.type === 'timeline' ? node.children[0] : node;
  const name = node.engine === 'css-animation' ? (node.type === 'timeline' ? node.label : node.name) : null;
  const target = leaf?.targets?.[0];
  // animationConditions walks every readable stylesheet rule; memoized so the
  // ~20fps tick re-render (live playhead) doesn't redo that walk. entries is
  // in the deps because it only changes when a scan finds something actually
  // different (see index.js's signatureOf) — including the resize-driven
  // rescans that flip which @media conditions are active.
  const conditional = useMemo(() => (name ? animationConditions(name, target) : []), [name, target, entries.value]);
  if (!conditional.length) {
    return html`<div class="gts-note">No viewport settings enabled.</div>`;
  }
  return conditional.map((d, i) => {
    const media = d.conditions.filter((c) => c.startsWith('@media ')).map((c) => c.slice('@media '.length));
    const label = media.map((q) => viewportLabel(q) || q).join(' and ') || d.conditions.join(' ');
    return html`<${Field}
      key=${'mm-' + i}
      label=${label}
      value=${`${d.conditions.join(' ')} (${d.active ? 'active' : 'inactive'})`}
    />`;
  });
}

export function PropertiesPanel() {
  const node = findNode(selectedId.value);
  // Captured once per render/drag gesture — see CodePanel.js's identical
  // startWidth comment for why this can't just read the live signal back.
  const startWidth = propsWidth.value;

  // Click-trigger detection is a source-text scan (see source.js's
  // findClickTriggers), same async-fetch shape as CodePanel's JS/CSS/HTML
  // resolution — it can't be computed synchronously off the node the way
  // scrollTriggerConfig/matchMediaConfig above are. css-animation/
  // css-transition have no JS call that could have wired up a click
  // listener at all (see resolveJs in CodePanel.js), so there's nothing to
  // scan for those. Hooks must run on every render regardless of which
  // branch below returns, so this sits above the early returns.
  const [sourceClickTriggers, setSourceClickTriggers] = useState(undefined);
  useEffect(() => {
    setSourceClickTriggers(undefined);
    if (!node || node.engine === 'css-animation' || node.engine === 'css-transition') return;
    let cancelled = false;
    findClickTriggers(node).then((r) => !cancelled && setSourceClickTriggers(r));
    return () => {
      cancelled = true;
    };
  }, [node?.id]);

  // Two live-DOM click-trigger signals, read straight off the node's real
  // targets rather than scanned from source text — synchronous, no
  // fetch/state needed, and just as strong a signal as source.js's exact
  // addEventListener('click', ...) match, so both are merged into the same
  // `strong` tier below rather than shown as separate categories:
  // reactClickTriggers (react-props.js) for a JSX `onClick` prop,
  // liveClickTriggers (click-ref.js) for a real, directly-attached listener
  // — including one reached only via a React ref's imperative
  // `.current.addEventListener('click', ...)`, which has no JSX prop for
  // the former to find and no source-text signal source.js could resolve
  // either (see click-ref.js's header comment). Recomputed whenever the
  // selection changes; a stale `strong` from a still-in-flight
  // findClickTriggers() fetch briefly missing these is fine, since both
  // always keep up with the current node regardless of that fetch's state.
  const liveTargets = useMemo(() => collectTargets(node ?? { children: [], targets: [] }), [node?.id]);
  const liveTriggers = useMemo(
    () => [...new Set([...reactClickTriggers(liveTargets), ...liveClickTriggers(liveTargets)])],
    [liveTargets]
  );
  const clickTriggers = useMemo(() => {
    if (!liveTriggers.length) return sourceClickTriggers;
    const strong = new Set([...(sourceClickTriggers?.strong || []), ...liveTriggers]);
    return { strong: [...strong], weak: sourceClickTriggers?.weak || [] };
  }, [sourceClickTriggers, liveTriggers]);

  if (!node) {
    return html`<div class="gts-props" style="width:${propsWidth.value}px">
      <${HResizeHandle} onDrag=${(dx) => setPropsWidth(startWidth + dx)} />
      <div class="gts-props-head">Properties</div>
      <div class="gts-note">Select an animation to inspect its parameters.</div>
    </div>`;
  }

  if (node.engine && node.engine !== 'gsap') {
    return html`<${CssProperties} node=${node} clickTriggers=${clickTriggers} />`;
  }

  const targets = node.type === 'tween' ? node.targets.map(targetLabel).join(', ') || '—' : `${countTargets(node)} target(s)`;
  const method = node.type === 'tween' ? methodGuess(node.vars || {}) : null;
  const varEntries = node.type === 'tween' ? visibleVarEntries(node.vars) : [];
  const fromEntries = method === 'fromTo' ? visibleVarEntries(node.vars.startAt) : [];
  const labelEntries = node.type === 'timeline' ? Object.entries(node.labels || {}) : [];
  const plugins = detectPlugins(node);
  const st = scrollTriggerConfig(node);
  const mm = matchMediaConfig(node);

  return html`
    <div class="gts-props" style="width:${propsWidth.value}px">
      <${HResizeHandle} onDrag=${(dx) => setPropsWidth(startWidth + dx)} />
      <div class="gts-props-head">
        ${node.type === 'timeline' ? 'Timeline' : 'Tween'}${node.isCompleted ? html` · <span class="gts-recon" title=${ENGINE_RECON_TEXT.gsap}>reconstructed</span>` : ''}
      </div>
      <${Field} label="Label" value=${node.label} />
      <${Field} label="Targets" value=${targets} />
      <${Field} label="Duration" value=${fmt(node.duration)} />
      <${Field} label="Repeat" value=${node.repeat === -1 ? 'infinite' : node.repeat || 0} />
      ${node.yoyo ? html`<${Field} label="Yoyo" value="true" />` : null}
      ${node.delay ? html`<${Field} label="Delay" value=${fmt(node.delay)} />` : null}
      ${labelEntries.length
        ? html`<hr class="gts-sep" />${labelEntries.map(([name, t]) => html`<${Field} key=${name} label=${name} value=${fmt(t)} />`)}`
        : null}
      ${fromEntries.length
        ? html`
            <hr class="gts-sep" />
            <div class="gts-props-subhead">From</div>
            ${fromEntries.map(([k, v]) => html`<${Field} key=${'from-' + k} label=${k} value=${formatVarValue(v)} />`)}
          `
        : null}
      ${varEntries.length
        ? html`
            <hr class="gts-sep" />
            <div class="gts-props-subhead">${method === 'from' ? 'From' : 'To'}</div>
            ${varEntries.map(([k, v]) => html`<${Field} key=${'to-' + k} label=${k} value=${formatVarValue(v)} />`)}
          `
        : null}

      <hr class="gts-sep" />
      <div class="gts-props-subhead">Plugins</div>
      ${plugins.length
        ? html`<div class="gts-chip-row">${plugins.map((p) => html`<span class="gts-chip" key=${p}>${p}</span>`)}</div>`
        : html`<div class="gts-note">None detected.</div>`}

      <hr class="gts-sep" />
      <div class="gts-props-subhead">Trigger</div>
      <${ClickTriggerField} clickTriggers=${clickTriggers} />
      ${st
        ? html`
            <${Field} label="Type" value="ScrollTrigger" />
            ${st.trigger ? html`<${Field} label="Trigger el" value=${st.trigger} />` : null}
            <${Field} label="Start" value=${st.start} />
            <${Field} label="End" value=${st.end} />
            ${st.scrub ? html`<${Field} label="Scrub" value="true" />` : null}
            ${st.toggleActions ? html`<${Field} label="Toggle actions" value=${st.toggleActions} />` : null}
            ${st.markers ? html`<${Field} label="Markers" value=${formatVarValue(st.markers)} />` : null}
          `
        : !clickTriggers?.strong?.length && !clickTriggers?.weak?.length
        ? html`<div class="gts-note">
            No trigger detected${node.isCompleted ? ' (unavailable once reconstructed).' : '.'}
          </div>`
        : null}

      <hr class="gts-sep" />
      <div class="gts-props-subhead">Viewport</div>
      ${mm
        ? Object.entries(mm.queries).map(([name, query]) => {
            const range = viewportLabel(query);
            const state = mm.conditions[name] ? 'active' : 'inactive';
            return html`<${Field}
              key=${name}
              label=${isGeneratedConditionName(name, query) ? range || 'query' : name}
              value=${range ? `${range} — ${query} (${state})` : `${query} (${state})`}
            />`;
          })
        : html`<div class="gts-note">No viewport settings enabled.</div>`}
    </div>
  `;
}
