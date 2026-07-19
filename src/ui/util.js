import { html } from 'htm/preact';

export const PPS = 120; // pixels per second in the track area
export const LABEL_W = 190; // track label column width

// Pointer-capture drag handle for a side panel's width (Properties/Code),
// dragged from its left edge, growing the panel as the pointer moves left.
// Same pattern as App.js's ResizeHandle (panel height), just the other axis.
// Collapse/expand chevrons. reicon.dev/icons/chevron-right and chevron-down
// (outline).
export function ChevronRightIcon() {
  return html`
    <svg viewBox="0 0 24 24" fill="none">
      <polyline points="6.5 2.75 12.75 9 6.5 15.25" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
    </svg>
  `;
}

export function ChevronLeftIcon() {
  return html`
    <svg viewBox="0 0 24 24" fill="none">
      <polyline points="11.5 15.25 5.25 9 11.5 2.75" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
    </svg>
  `;
}

export function ChevronDownIcon() {
  return html`
    <svg viewBox="0 0 24 24" fill="none">
      <polyline points="15.25 6.5 9 12.75 2.75 6.5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
    </svg>
  `;
}

// reicon.dev/icons/repeat (outline) — used for loop toggles and the list
// row's reset action.
export function RepeatIcon() {
  return html`
    <svg viewBox="0 0 24 24" fill="none">
      <path fill-rule="evenodd" clip-rule="evenodd" d="M8.46967 2.46967C8.76256 2.17678 9.23744 2.17678 9.53033 2.46967L11.5303 4.46967C11.7448 4.68417 11.809 5.00676 11.6929 5.28701C11.5768 5.56727 11.3033 5.75 11 5.75H9C5.54822 5.75 2.75 8.54822 2.75 12C2.75 15.4517 5.54846 18.25 9.00028 18.25H9.5C9.91421 18.25 10.25 18.5858 10.25 19C10.25 19.4142 9.91421 19.75 9.5 19.75H9.00028C4.72011 19.75 1.25 16.2802 1.25 12C1.25 7.71979 4.71979 4.25 9 4.25H9.18934L8.46967 3.53033C8.17678 3.23744 8.17678 2.76256 8.46967 2.46967ZM13.75 5C13.75 4.58579 14.0858 4.25 14.5 4.25H15C19.2802 4.25 22.75 7.71979 22.75 12C22.75 16.2802 19.2802 19.75 15 19.75H14.8107L15.5303 20.4697C15.8232 20.7626 15.8232 21.2374 15.5303 21.5303C15.2374 21.8232 14.7626 21.8232 14.4697 21.5303L12.4697 19.5303C12.2552 19.3158 12.191 18.9932 12.3071 18.713C12.4232 18.4327 12.6967 18.25 13 18.25H15C18.4518 18.25 21.25 15.4518 21.25 12C21.25 8.54822 18.4518 5.75 15 5.75H14.5C14.0858 5.75 13.75 5.41421 13.75 5Z" fill="currentColor"/>
    </svg>
  `;
}

// Pointer-capture drag handle for a side panel's width (Properties/Code),
// dragged from its left edge, growing the panel as the pointer moves left.
// Same pattern as App.js's ResizeHandle (panel height), just the other axis.
export function HResizeHandle({ onDrag }) {
  const onPointerDown = (e) => {
    e.preventDefault();
    e.target.setPointerCapture?.(e.pointerId);
    const start = e.clientX;
    const prevCursor = document.body.style.cursor;
    document.body.style.cursor = 'ew-resize';
    const move = (ev) => {
      ev.preventDefault();
      onDrag(start - ev.clientX);
    };
    const up = () => {
      document.body.style.cursor = prevCursor;
      e.target.removeEventListener('pointermove', move);
      e.target.removeEventListener('pointerup', up);
      e.target.removeEventListener('pointercancel', up);
    };
    e.target.addEventListener('pointermove', move);
    e.target.addEventListener('pointerup', up);
    e.target.addEventListener('pointercancel', up);
  };
  return html`<div class="gts-panel-resize-h" onPointerDown=${onPointerDown}></div>`;
}

export const fmt = (t) => `${(t || 0).toFixed(2)}s`;

// Scroll-driven (progress-domain) nodes normalise 100% of scroll progress to
// a duration of 1 (see detect-css.js), format those as percentages, and
// everything else as seconds.
export const fmtTime = (node, t) => (node.progressDomain ? `${Math.round((t || 0) * 100)}%` : fmt(t));

// Engine chip shown on every row so GSAP and CSS/WAAPI entries read apart at
// a glance in the list view, same as the peach/sage split on track blocks
// (see styles.js). Keyed off node.engine, set by each detection source.
const ENGINE_CHIPS = {
  gsap: { text: 'GSAP', title: 'GSAP animation (gsap.globalTimeline)' },
  'css-animation': { text: 'CSS', title: 'CSS animation (@keyframes)' },
  'css-transition': { text: 'CSS', title: 'CSS transition' },
  waapi: { text: 'WAAPI', title: 'Web Animations API (element.animate)' },
  motion: { text: 'MOTION', title: 'Motion animation (motion.dev), attributed by call-site (best-effort)' },
};

export function engineChip(node) {
  return ENGINE_CHIPS[node.engine] || null;
}

// Explains what the gts-recon "reconstructed" badge means, per detection
// source: each engine's own live instance disappears in a different way
// (gsap.globalTimeline auto-removal, document.getAnimations() dropping a
// finished/irrelevant Animation, ...), so a single GSAP-flavoured sentence
// read wrong on a CSS/WAAPI/Motion row (see Tracks.js/PropertiesPanel.js).
export const ENGINE_RECON_TEXT = {
  gsap: 'Finished and removed from gsap.globalTimeline, this is a reconstructed copy for scrubbing, not the original instance.',
  'css-animation': 'Finished (or its element unmounted) and dropped by the browser, this is a reconstructed @keyframes replay for scrubbing, not the original animation.',
  'css-transition': 'Finished and dropped by the browser, this is a reconstructed replay for scrubbing, not the original transition.',
  waapi: 'Finished and dropped from document.getAnimations(), this is a reconstructed replay for scrubbing, not the original element.animate() call.',
  motion: "Finished and dropped from document.getAnimations(), this is a reconstructed replay of Motion's underlying WAAPI animation for scrubbing, not the original.",
};

// Groups the more granular node.engine values (css-animation/css-transition
// both read as "CSS") into the filter options shown in the list-view engine
// dropdown (see store.js's engineFilter and ui/ListView.js).
const ENGINE_GROUPS = {
  gsap: 'gsap',
  'css-animation': 'css',
  'css-transition': 'css',
  waapi: 'waapi',
  motion: 'motion',
};

export const ENGINE_FILTERS = [
  { value: 'all', label: 'All engines' },
  { value: 'gsap', label: 'GSAP' },
  { value: 'css', label: 'CSS' },
  { value: 'waapi', label: 'WAAPI' },
  { value: 'motion', label: 'Motion' },
];

export function matchesEngineFilter(node, filter) {
  if (filter === 'all') return true;
  return ENGINE_GROUPS[node.engine] === filter;
}

// Which engine groups actually appear anywhere in the detected tree (a node
// itself or any nested child), so the list-view dropdown (see ui/ListView.js)
// only offers filters that would show something.
function collectEngineGroups(node, groups) {
  const group = ENGINE_GROUPS[node.engine];
  if (group) groups.add(group);
  for (const child of node.children || []) collectEngineGroups(child, groups);
}

export function availableEngineFilters(entries) {
  const groups = new Set();
  for (const entry of entries) collectEngineGroups(entry, groups);
  return ENGINE_FILTERS.filter((f) => f.value === 'all' || groups.has(f.value));
}

// Structural tween vars that aren't really "parameters" a user authored to
// be animated (timing/identity plumbing, or callbacks), filtered out
// anywhere a node's vars are surfaced as a list (track tooltips, the Code
// panel, the Properties panel), so all three stay in sync.
const STRUCTURAL_VAR_KEYS = new Set([
  'id', 'data', 'yoyo', 'repeat', 'repeatDelay', 'delay', 'startAt', 'runBackwards', 'paused', 'overwrite', 'parent',
]);

export function visibleVarEntries(vars) {
  return Object.entries(vars || {}).filter(
    ([k, v]) => !STRUCTURAL_VAR_KEYS.has(k) && typeof v !== 'function'
  );
}

// GSAP internals (Timeline linked-list nodes, an element's `_gsap` cache,
// ScrollTrigger's own animation back-reference, ...) are all circular, and a
// tween's vars can end up holding one of these as a value; JSON.stringify
// must be guarded rather than left to throw uncaught mid-render.
export function formatVarValue(v) {
  if (typeof v !== 'object' || v === null) return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return '{ … }';
  }
}

export function varsSummary(vars) {
  const entries = visibleVarEntries(vars);
  const shown = entries
    .slice(0, 3)
    .map(([k, v]) => `${k}: ${typeof v === 'object' && v !== null ? '…' : v}`)
    .join(', ');
  return entries.length > 3 ? `${shown}, …` : shown;
}

// Full, unabridged "key: value" lines for a node's own vars: used for the
// gts-block hover tooltip (native `title`, so plain text/newlines only) and
// anywhere else the complete parameter list (not the truncated summary
// above) is needed.
export function paramLines(node) {
  if (node.type !== 'tween') return [];
  if (node.engine && node.engine !== 'gsap') {
    const lines = [];
    if (node.keyframes?.length) lines.push(`${node.keyframes.length} keyframes`);
    if (node.animatedProps?.length) lines.push(`props: ${node.animatedProps.join(', ')}`);
    if (node.direction && node.direction !== 'normal') lines.push(`direction: ${node.direction}`);
    if (node.fill && node.fill !== 'none') lines.push(`fill: ${node.fill}`);
    if (node.easing && node.easing !== 'linear') lines.push(`easing: ${node.easing}`);
    return lines;
  }
  return visibleVarEntries(node.vars).map(([k, v]) => `${k}: ${formatVarValue(v)}`);
}

// What a node's track block says on its face: gsap tweens show their vars,
// css/waapi leaves show which properties they animate, and container rows
// say what kind of container they are.
export function blockSummary(node) {
  if (node.type === 'timeline') {
    if (node.engine === 'css-animation') return `@keyframes ${node.label}`;
    if (node.engine === 'css-transition') return 'transitions';
    return 'timeline';
  }
  if (node.engine && node.engine !== 'gsap') return (node.animatedProps || []).join(', ') || node.label;
  return varsSummary(node.vars);
}

// Flatten a node and its children into rows with a depth for indentation,
// tracking each row's start time relative to its top-level entry (children
// carry a `start` local to their immediate parent, so this accumulates).
export function flattenNode(node, depth, offset, out) {
  const start = offset + (node.start || 0);
  out.push({ node, depth, start });
  for (const child of node.children || []) flattenNode(child, depth + 1, start, out);
  return out;
}

export function matchesQuery(node, q) {
  if (!q) return true;
  const needle = q.toLowerCase();
  if (node.label?.toLowerCase().includes(needle)) return true;
  return (node.children || []).some((c) => matchesQuery(c, needle));
}

// Like flattenNode, but skips a node's children unless its id is in
// `expanded`, used by the list view, which lets timelines be
// expanded/collapsed (collapsed by default) independently of the (always
// fully expanded) track view.
export function flattenVisible(node, depth, expanded, out) {
  out.push({ node, depth });
  if (!expanded.has(node.id)) return out;
  for (const child of node.children || []) flattenVisible(child, depth + 1, expanded, out);
  return out;
}
