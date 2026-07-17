// Central UI state, held in preact signals. There's no authored data model
// any more; everything the panel shows is read off the host page's own
// gsap.globalTimeline (see detect.js).

import { signal, effect } from '@preact/signals';

// Panel chrome (open/closed, size, which inspectors are showing) survives a
// page reload by mirroring itself to localStorage; everything else
// (detected entries, selection, search) is intentionally NOT persisted since
// it's re-derived from the live page / a fresh node-id counter each load
// (see detect.js) and would just be stale or meaningless across a reload.
const PERSIST_KEY = 'timeline-lens:panel';

function loadPersisted() {
  if (typeof localStorage === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(PERSIST_KEY)) || {};
  } catch {
    return {};
  }
}
const persisted = loadPersisted();

// panel visibility
export const panelOpen = signal(persisted.panelOpen ?? false);

// mini player: a compact floating transport bar at the bottom of the page
// (animation dropdown + playback controls), toggled from the toolbar as a
// lighter alternative to the full panel. Open/closed state persists like the
// panel's; which animation it controls is selectedId, shared with the panel,
// so switching between the two keeps the same animation in focus.
export const miniOpen = signal(persisted.miniOpen ?? false);
export const PANEL_MIN_HEIGHT = 220;
export const panelHeight = signal(persisted.panelHeight ?? 360);

export function setPanelHeight(v) {
  const max = typeof window !== 'undefined' ? window.innerHeight - 60 : 900;
  panelHeight.value = Math.round(Math.max(PANEL_MIN_HEIGHT, Math.min(max, v)));
}

// side-panel widths (Properties/Code), independently resizable and
// persisted the same way as panelHeight above
export const PROPS_MIN_WIDTH = 200;
export const CODE_MIN_WIDTH = 240;
export const propsWidth = signal(persisted.propsWidth ?? 260);
export const codeWidth = signal(persisted.codeWidth ?? 340);

function widthMax() {
  return typeof window !== 'undefined' ? Math.round(window.innerWidth * 0.6) : 900;
}

export function setPropsWidth(v) {
  propsWidth.value = Math.round(Math.max(PROPS_MIN_WIDTH, Math.min(widthMax(), v)));
}

export function setCodeWidth(v) {
  codeWidth.value = Math.round(Math.max(CODE_MIN_WIDTH, Math.min(widthMax(), v)));
}

// Persisted sizes can come from a bigger window (or the window can shrink
// while the panel is open), so re-run the clamps against the live viewport
// on load and on every resize — otherwise a stale height/width leaves the
// panel or a side panel covering everything else.
if (typeof window !== 'undefined') {
  const clampToViewport = () => {
    setPanelHeight(panelHeight.value);
    setPropsWidth(propsWidth.value);
    setCodeWidth(codeWidth.value);
  };
  clampToViewport();
  window.addEventListener('resize', clampToViewport);
}

// detected top-level entries, refreshed by rescan() in detect.js
export const entries = signal([]);

// list/track selection + hover, by node id. Selecting an entry (or any of
// its nested children) in the list is what the track view filters down to
// (see entryForNode below); hovering (list or track) highlights the real
// DOM target(s).
export const selectedId = signal(null);
export const hoveredId = signal(null);

// list-view search/filter text
export const query = signal('');

// list-view engine filter, 'all' or one of the ENGINE_GROUPS keys in
// ui/util.js (gsap/css/waapi); entries whose engine falls outside the
// selected group are hidden
export const engineFilter = signal('all');

// whole list panel, minimized to a thin rail via the toolbar/rail button
export const listCollapsed = signal(persisted.listCollapsed ?? false);

// per-node expand/collapse state in the list view (a Set of node ids whose
// children are shown; everything else starts collapsed), independent of
// the track view, which always shows a selected entry's full tree
export const expandedNodeIds = signal(new Set());

export function toggleNodeCollapsed(id) {
  const next = new Set(expandedNodeIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  expandedNodeIds.value = next;
}

// right-hand inspector panels, toggled from the toolbar
export const propertiesOpen = signal(persisted.propertiesOpen ?? true);
export const codeOpen = signal(persisted.codeOpen ?? false);

// label/keyframe markers overlaid on the track view, toggled from the
// ruler corner; persisted like the rest of the panel chrome
export const markersVisible = signal(persisted.markersVisible ?? true);

if (typeof localStorage !== 'undefined') {
  effect(() => {
    const snapshot = {
      panelOpen: panelOpen.value,
      miniOpen: miniOpen.value,
      panelHeight: panelHeight.value,
      propsWidth: propsWidth.value,
      codeWidth: codeWidth.value,
      listCollapsed: listCollapsed.value,
      propertiesOpen: propertiesOpen.value,
      codeOpen: codeOpen.value,
      markersVisible: markersVisible.value,
    };
    try {
      localStorage.setItem(PERSIST_KEY, JSON.stringify(snapshot));
    } catch {}
  });
}

// Find a node (top-level entry or nested child) by id, anywhere in `entries`.
export function findNode(id) {
  if (!id) return null;
  const stack = [...entries.value];
  while (stack.length) {
    const node = stack.pop();
    if (node.id === id) return node;
    stack.push(...(node.children || []));
  }
  return null;
}

// The top-level entry that owns a given node id (itself, if it's already
// top-level): what the track view renders once something is selected.
export function entryForNode(id) {
  if (!id) return null;
  for (const entry of entries.value) {
    const stack = [entry];
    while (stack.length) {
      const node = stack.pop();
      if (node.id === id) return entry;
      stack.push(...(node.children || []));
    }
  }
  return null;
}

// bumped on a throttled ticker so live (non-interacted) playheads keep
// moving in the track view without each row owning its own render loop
export const tick = signal(0);

// top-level entry ids currently set to auto-restart on completion, toggled
// from the transport's loop button; not persisted, same as selectedId:
// entry ids are regenerated each load, so a stale id would be meaningless.
export const loopIds = signal(new Set());

export function toggleLoop(id) {
  const next = new Set(loopIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  loopIds.value = next;
}

// Which gts-body panels are collapsed when stacked vertically on mobile
// (see App.js's MobileSection). Not persisted: the stacked layout only
// exists below the mobile breakpoint, so a stale collapse set from a
// desktop session would be meaningless.
export const mobileSectionCollapsed = signal(new Set());

export function toggleMobileSection(id) {
  const next = new Set(mobileSectionCollapsed.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  mobileSectionCollapsed.value = next;
}
