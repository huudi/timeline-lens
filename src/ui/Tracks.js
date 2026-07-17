// Read-only track view for the currently selected animation: one row per
// node in its tree (itself + nested timeline children, indented), plus any
// labels on a timeline row. Other top-level entries aren't shown here at
// all, that's what the list view is for; picking one there is what decides
// what this view renders (see entryForNode in store.js).
//
// Scrubbing happens on the ruler, against the top-level entry's own real (or
// reconstructed, for a completed entry) instance, nested children are
// positioned inside that same instance, so dragging the ruler moves the
// whole tree together, the same way GSAP itself nests child timing.

import { html } from 'htm/preact';
import { useEffect, useRef } from 'preact/hooks';
import { selectedId, hoveredId, entryForNode, tick, markersVisible } from '../store.js';
import { seek, currentTime } from '../playback.js';
import { showHighlight, clearHighlight } from '../highlight.js';
import { PPS, LABEL_W, fmtTime, blockSummary, paramLines, flattenNode, ENGINE_RECON_TEXT } from './util.js';

// Pixels per unit for an entry's tracks: seconds for time-based entries,
// 0–1 scroll progress for scroll-driven ones (whose whole domain is one
// unit, rendered wider so 100% of progress isn't a 120px sliver).
function ppsFor(entry) {
  return entry.progressDomain ? PPS * 4 : PPS;
}

function rulerScrub(e, entry) {
  e.preventDefault();
  const lane = e.currentTarget;
  const rect = lane.getBoundingClientRect();
  const pps = ppsFor(entry);
  const toTime = (ev) => Math.max(0, (ev.clientX - rect.left) / pps);
  try {
    lane.setPointerCapture(e.pointerId);
  } catch {}
  seek(entry, toTime(e));
  const move = (ev) => seek(entry, toTime(ev));
  const up = () => {
    lane.removeEventListener('pointermove', move);
    lane.removeEventListener('pointerup', up);
  };
  lane.addEventListener('pointermove', move);
  lane.addEventListener('pointerup', up);
}

function Ruler({ total, entry }) {
  const pps = ppsFor(entry);
  const marks = [];
  if (entry.progressDomain) {
    // Scroll-driven entries live in scroll progress, not time, 100% of
    // progress is normalised to a duration of 1 (see detect-css.js), so the
    // ruler reads 0–100% instead of seconds.
    for (let i = 0; i * 0.125 <= total + 0.001; i++) {
      marks.push({ t: i * 0.125, major: i % 2 === 0, text: `${i * 12.5}%` });
    }
  } else {
    for (let i = 0; i * 0.5 <= total + 0.001; i++) marks.push({ t: i * 0.5, major: i % 2 === 0, text: `${i * 0.5}` });
  }
  return html`
    <div class="gts-row gts-ruler-row">
      <div class="gts-row-label gts-ruler-corner">
        <button
          class="gts-markers-toggle ${markersVisible.value ? 'on' : ''}"
          title=${markersVisible.value
            ? 'Hide timeline label / keyframe markers'
            : 'Show timeline label / keyframe markers'}
          onClick=${() => (markersVisible.value = !markersVisible.value)}
        >
          ⚑ Labels
        </button>
      </div>
      <div class="gts-lane gts-ruler" onPointerDown=${(e) => rulerScrub(e, entry)}>
        ${marks.map(
          (m) => html`
            <div class="gts-tick ${m.major ? 'major' : ''}" style="left:${m.t * pps}px">
              ${m.major ? html`<span>${m.text}</span>` : null}
            </div>
          `
        )}
      </div>
    </div>
  `;
}

function Playhead({ entry }) {
  tick.value; // keep this moving as the ticker advances
  const t = Math.min(entry.duration, currentTime(entry));
  return html`<div class="gts-playhead" style="left:${LABEL_W + t * ppsFor(entry)}px"></div>`;
}

function LabelMarker({ name, t, pps, kf }) {
  return html`
    <div class="gts-label-marker ${kf ? 'kf' : ''}" style="left:${LABEL_W + t * pps}px">
      <div class="gts-label-tag">${name}</div>
    </div>
  `;
}

function allTargets(node) {
  if (node.type === 'tween') return node.targets;
  return (node.children || []).flatMap(allTargets);
}

function TrackRow({ node, depth, start, pps }) {
  const selected = selectedId.value === node.id;
  const hovered = hoveredId.value === node.id;
  const onEnter = () => {
    hoveredId.value = node.id;
    showHighlight(allTargets(node));
  };
  const onLeave = () => {
    hoveredId.value = null;
    clearHighlight();
  };
  return html`
    <div
      class="gts-row ${selected ? 'sel' : ''} ${hovered ? 'hover' : ''}"
      data-node-id=${node.id}
      onMouseEnter=${onEnter}
      onMouseLeave=${onLeave}
    >
      <div
        class="gts-row-label"
        style="padding-left:${8 + depth * 14}px"
        title=${node.label}
        onClick=${() => (selectedId.value = node.id)}
      >
        <span class="gts-row-name">${node.label}</span>
        ${node.isCompleted
          ? html`<span class="gts-recon" title=${ENGINE_RECON_TEXT[node.engine ?? 'gsap']}>◌</span>`
          : null}
      </div>
      <div class="gts-lane" onClick=${() => (selectedId.value = node.id)}>
        <div
          class="gts-block ${node.type} ${node.isCompleted ? 'ro' : ''} ${node.engine === 'motion' ? 'motion' : node.engine && node.engine !== 'gsap' ? 'css' : ''}"
          style="left:${start * pps}px;width:${Math.max(8, node.duration * pps)}px"
          title="${[
            `${node.label} · ${fmtTime(node, node.duration)}${node.repeat === -1 ? ' · loops forever' : node.repeat ? ` · repeat ${node.repeat}` : ''}`,
            ...paramLines(node),
          ].join('\n')}"
        >
          <span>${blockSummary(node)}</span>
        </div>
      </div>
    </div>
  `;
}

export function TrackView() {
  const containerRef = useRef(null);
  const entry = entryForNode(selectedId.value);

  useEffect(() => {
    const id = selectedId.value;
    if (!id || !containerRef.current) return;
    const row = containerRef.current.querySelector(`[data-node-id="${id}"]`);
    row?.scrollIntoView({ block: 'nearest' });
  }, [selectedId.value]);

  if (!entry) {
    return html`<div class="gts-tracks">
      <div class="gts-tracks-empty">Select an animation from the list to inspect its tracks.</div>
    </div>`;
  }

  const rows = flattenNode(entry, 0, 0, []);
  const pps = ppsFor(entry);
  const maxEnd = Math.max(...rows.map((r) => r.start + (r.node.duration || 0)));
  // Scroll-driven entries span exactly one progress unit (0–100%); time-based
  // ones round up to the next half second so the ruler always outruns the
  // last block a little.
  const total = entry.progressDomain ? 1 : Math.max(2, Math.ceil((maxEnd + 0.5) * 2) / 2);
  const labelMarkers = rows.flatMap(({ node, start }) =>
    node.type === 'timeline' && node.labels
      ? Object.entries(node.labels).map(([name, t]) => ({ key: `${node.id}-${name}`, name, t: start + t }))
      : []
  );
  // Intermediate @keyframes stops (not the 0%/100% endpoints) rendered like
  // timeline labels, deduped by position, since a @keyframes group repeats
  // the same stops on every one of its target rows.
  const kfMarkers = [];
  const seenOffsets = new Set();
  for (const { node, start } of rows) {
    if (node.type !== 'tween' || node.engine === 'gsap' || !node.keyframes) continue;
    for (const kf of node.keyframes) {
      const offset = kf.computedOffset ?? kf.offset;
      if (offset == null || offset <= 0 || offset >= 1) continue;
      const t = start + offset * node.duration;
      const key = Math.round(t * 1000);
      if (seenOffsets.has(key)) continue;
      seenOffsets.add(key);
      kfMarkers.push({ key: `kf-${node.id}-${key}`, name: `${Math.round(offset * 100)}%`, t });
    }
  }

  return html`
    <div class="gts-tracks">
      <div class="gts-tracks-scroll" ref=${containerRef}>
        <div class="gts-tracks-content" style="width:${LABEL_W + (total + 0.75) * pps}px">
          <${Ruler} total=${total} entry=${entry} />
          ${rows.map(({ node, depth, start }) => html`<${TrackRow} key=${node.id} node=${node} depth=${depth} start=${start} pps=${pps} />`)}
          ${markersVisible.value ? labelMarkers.map((m) => html`<${LabelMarker} key=${m.key} name=${m.name} t=${m.t} pps=${pps} />`) : null}
          ${markersVisible.value ? kfMarkers.map((m) => html`<${LabelMarker} key=${m.key} name=${m.name} t=${m.t} pps=${pps} kf=${true} />`) : null}
          <${Playhead} entry=${entry} />
        </div>
      </div>
    </div>
  `;
}
