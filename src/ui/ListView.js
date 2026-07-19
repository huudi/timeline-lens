// Flat, searchable/filterable list of every detected animation, a real
// project can easily have more running animations than fit comfortably as
// tracks alone. Selecting a row scrolls to and highlights its row in the
// track view (see selectedId in store.js, read by Tracks.js), and scrolls
// the row's real target element into view on the page itself; hovering
// highlights the real target element(s) on the page, same as in the track
// view. Timelines with children start collapsed and can be expanded
// independently of the (always fully expanded) track view, and the whole
// panel can be minimized to a thin rail.

import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import {
  entries,
  selectedId,
  hoveredId,
  query,
  listCollapsed,
  expandedNodeIds,
  toggleNodeCollapsed,
  engineFilter,
  listWidth,
  setListWidth,
} from '../store.js';
import { showHighlight, clearHighlight } from '../highlight.js';
import { resetNode } from '../playback.js';
import { fmt, fmtTime, engineChip, flattenNode, flattenVisible, matchesQuery, matchesEngineFilter, availableEngineFilters } from './util.js';

const RESET_SPIN_MS = 500;

function ListResizeHandle() {
  const onPointerDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.target.setPointerCapture?.(e.pointerId);
    const start = e.clientX;
    const startWidth = listWidth.value;
    const move = (ev) => setListWidth(startWidth + (ev.clientX - start));
    const up = () => {
      e.target.removeEventListener('pointermove', move);
      e.target.removeEventListener('pointerup', up);
      e.target.removeEventListener('pointercancel', up);
    };
    e.target.addEventListener('pointermove', move);
    e.target.addEventListener('pointerup', up);
    e.target.addEventListener('pointercancel', up);
  };
  return html`<div class="gts-list-resize" onPointerDown=${onPointerDown}></div>`;
}

function allTargets(node) {
  if (node.type === 'tween') return node.targets;
  return (node.children || []).flatMap(allTargets);
}

function ListRow({ node, depth }) {
  const selected = selectedId.value === node.id;
  const hovered = hoveredId.value === node.id;
  const targetCount = allTargets(node).length;
  const hasChildren = (node.children || []).length > 0;
  const collapsed = !expandedNodeIds.value.has(node.id);
  const [spinning, setSpinning] = useState(false);
  return html`
    <div
      class="gts-list-row ${selected ? 'on' : ''} ${hovered ? 'hover' : ''}"
      style="padding-left:${4 + depth * 12}px"
      onClick=${() => {
        selectedId.value = node.id;
        const [target] = allTargets(node);
        if (target && typeof target.scrollIntoView === 'function') {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }}
      onMouseEnter=${() => {
        hoveredId.value = node.id;
        showHighlight(allTargets(node));
      }}
      onMouseLeave=${() => {
        hoveredId.value = null;
        clearHighlight();
      }}
    >
      <div class="gts-list-row-head">
        <button
          class="gts-list-caret ${hasChildren ? '' : 'hide'}"
          title=${collapsed ? 'Expand' : 'Collapse'}
          onClick=${(e) => {
            e.stopPropagation();
            toggleNodeCollapsed(node.id);
          }}
        >
          ${hasChildren ? (collapsed ? '▸' : '▾') : ''}
        </button>
        <div class="gts-list-name-col">
          <span class="gts-list-name" title=${node.label}>
            <span
              class="gts-list-badge ${node.type === 'timeline' ? 'gts-list-badge-t' : 'gts-list-badge-a'}"
              title=${node.type === 'timeline' ? 'Timeline' : 'Animation'}
              >${node.type === 'timeline' ? 'T' : 'A'}</span
            >${node.label}${engineChip(node)
              ? html`<span class="gts-list-engine ${node.engine === 'gsap' ? 'gsap' : node.engine === 'motion' ? 'motion' : ''}" title=${engineChip(node).title}>${engineChip(node).text}</span>`
              : null}
          </span>
          <span class="gts-list-meta">
            ${targetCount ? html`${targetCount} target${targetCount === 1 ? '' : 's'} · ` : null}${fmtTime(node, node.duration)}${node.repeat === -1
              ? ' · ∞'
              : node.repeat
                ? ` · ×${node.repeat + 1}`
                : ''}${node.yoyo ? ' · yoyo' : ''}${node.delay ? ` · delay ${fmt(node.delay)}` : ''}
          </span>
        </div>
        <button
          class="gts-list-reset ${spinning ? 'spin' : ''}"
          title="Reset — clears inline styles this animation left on its target(s) and stops it"
          onClick=${(e) => {
            e.stopPropagation();
            resetNode(node);
            setSpinning(true);
            setTimeout(() => setSpinning(false), RESET_SPIN_MS);
          }}
        >
          ↻
        </button>
      </div>
    </div>
  `;
}

function ExpandedList() {
  const filters = availableEngineFilters(entries.value);
  // The previously selected engine can drop out of the tree entirely (its
  // last matching animation finished and got pruned, or a rescan ran), so
  // fall back to 'all' rather than silently filtering everything out.
  if (engineFilter.value !== 'all' && !filters.some((f) => f.value === engineFilter.value)) {
    engineFilter.value = 'all';
  }
  const list = entries.value
    .filter((e) => matchesEngineFilter(e, engineFilter.value))
    .filter((e) => matchesQuery(e, query.value));
  // While searching, ignore collapse state so matches nested inside a
  // collapsed timeline are still reachable.
  const rows = query.value
    ? list.flatMap((entry) => flattenNode(entry, 0, 0, []))
    : list.flatMap((entry) => flattenVisible(entry, 0, expandedNodeIds.value, []));

  return html`
    <div class="gts-list" style="width:${listWidth.value}px">
      <${ListResizeHandle} />
      <div class="gts-list-head">
        <select
          class="gts-list-engine-filter"
          title="Filter by engine"
          value=${engineFilter.value}
          onChange=${(e) => (engineFilter.value = e.target.value)}
        >
          ${filters.map((f) => html`<option value=${f.value}>${f.label}</option>`)}
        </select>
        <button class="gts-list-collapse-btn" title="Minimize list" onClick=${() => (listCollapsed.value = true)}>«</button>
      </div>
      <div class="gts-list-head">
        <input
          class="gts-list-search"
          placeholder="Search detected animations…"
          value=${query.value}
          onInput=${(e) => (query.value = e.target.value)}
        />
      </div>
      <div class="gts-list-rows">
        ${rows.length === 0
          ? html`<div class="gts-list-empty">
              ${entries.value.length === 0 ? 'No animations detected yet.' : 'No matches.'}
            </div>`
          : rows.map(({ node, depth }) => html`<${ListRow} key=${node.id} node=${node} depth=${depth} />`)}
      </div>
    </div>
  `;
}

export function ListView() {
  if (listCollapsed.value) {
    return html`<div class="gts-list gts-list-rail">
      <button class="gts-list-collapse-btn" title="Expand list" onClick=${() => (listCollapsed.value = false)}>»</button>
    </div>`;
  }
  return html`<${ExpandedList} />`;
}
