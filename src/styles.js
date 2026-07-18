// All studio styles live inside the shadow root, so nothing here can collide
// with the host page and nothing from the host page leaks in.
//
// Design language matches the Timeline Lens marketing site: ink surfaces,
// cream text, lime accent, pastel clip colours (sage/lavender/peach), mono
// uppercase labels and pill-shaped buttons.

export const cssText = /* css */ `
:host {
  --bg: #1b1e26;
  --bg2: #232734;
  --bg3: #2b3040;
  --bg4: #353b4e;
  --border: #333948;
  --text: #ffffff;
  --dim: #8a91a2;
  --ink: #0e0e0c;
  --accent: #c9f24b;
  --accent-soft: rgba(201, 242, 75, 0.14);
  --sel: #c9c2f2;
  --sel-soft: rgba(201, 194, 242, 0.16);
  --sage: #93cfae;
  --ov: #f2b98b;
  --motion: #f2a8c9;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
button { background: none; border: 0; cursor: pointer; }
button, input, select {
  font: inherit;
  color: inherit;
}
input, select {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 3px 8px;
  color: var(--text);
  min-width: 0;
}
input:focus, select:focus { outline: 1px solid var(--accent); outline-offset: 0; }
button:focus-visible, a:focus-visible { outline: 1px solid var(--accent); outline-offset: 1px; }

/* ---- trigger button ---- */
.gts-trigger {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 10;
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: var(--ink);
  color: var(--accent);
  font: 700 12px/1 -apple-system, "Segoe UI", Roboto, sans-serif;
  box-shadow: inset 0 0 0 1.5px rgba(255, 255, 255, 0.22), 0 4px 14px rgba(0, 0, 0, 0.45);
  transition: bottom 0.2s ease, transform 0.15s ease, opacity 0.25s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}
.gts-trigger svg { width: 22px; height: 22px; }
.gts-trigger:hover { transform: scale(1.06); }
.gts-trigger.open { opacity: 0; pointer-events: none; }

/* ---- panel (height set inline from the panelHeight signal, see App.js) ---- */
.gts-panel {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 5;
  display: flex;
  flex-direction: column;
  background: var(--bg);
  color: var(--text);
  border-top: 1px solid var(--border);
  border-radius: 18px 18px 0 0;
  font: 12px/1.45 -apple-system, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  box-shadow: 0 -8px 30px rgba(0, 0, 0, 0.4);
  max-height: calc(100vh - 24px);
}
.gts-panel-resize {
  position: absolute;
  top: -4px;
  left: 0;
  right: 0;
  height: 8px;
  cursor: ns-resize;
  z-index: 6;
}
.gts-panel-resize:hover, .gts-panel-resize:active { background: var(--accent-soft); }

/* ---- side-panel (Properties/Code) width resize handle ---- */
.gts-panel-resize-h {
  position: absolute;
  top: 0;
  bottom: 0;
  left: -4px;
  width: 8px;
  cursor: ew-resize;
  z-index: 6;
}
.gts-panel-resize-h:hover, .gts-panel-resize-h:active { background: var(--accent-soft); }

/* ---- toolbar ----
   brand (left), transport (middle), actions (right) share one row while
   they fit; container-queried against the toolbar's own width (not the
   viewport) so it responds to the panel being resized, not just resized
   windows — transport drops to a row of its own below 1250px, and once
   dropped it spreads across the full width instead of staying centered. */
.gts-toolbar {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 42px;
  padding: 6px 14px;
  background: var(--bg2);
  border-bottom: 1px solid var(--border);
  border-radius: 18px 18px 0 0;
  flex: none;
  container-type: inline-size;
}
.gts-toolbar-top {
  display: grid;
  grid-template-columns: auto 1fr auto;
  grid-template-areas: "brand transport actions";
  align-items: center;
  gap: 8px 14px;
}
/* only shown once the transport has dropped to its own full-width row
   below the brand/actions (see the 1250px container query below) — inline
   in the toolbar there's no room for a track, and the ruler in the tracks
   panel already covers scrubbing */
.gts-transport-scrub { display: none; }
@container (max-width: 1250px) {
  .gts-toolbar-top {
    grid-template-columns: 1fr auto;
    grid-template-areas: "brand actions" "transport transport";
  }
  /* dropped transport spans the toolbar's full width, so it gets a
     scrubbing track (like the mini player's) instead of just the compact
     cluster + readout, and spreads across the row instead of staying
     centered */
  .gts-transport { width: 100%; justify-content: space-between; }
  .gts-transport-scrub { display: block; }
}
.gts-toolbar-transport {
  grid-area: transport;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 6px 8px;
  min-width: 0;
}
/* brand + animation count read as one identity block on the left, keeping
   the transport area purely about playback */
.gts-brand-group {
  grid-area: brand;
  display: flex;
  align-items: baseline;
  gap: 12px;
  min-width: 0;
}
.gts-brand {
  grid-area: brand;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-right: 10px;
  white-space: nowrap;
}
.gts-brand-mark {
  position: relative;
  display: inline-flex;
  align-items: center;
}
.gts-brand-logo {
  height: 13px;
  width: auto;
  display: block;
  align-self: center;
}
.gts-beta {
  position: absolute;
  top: -7px;
  right: -10px;
  padding: 1px 5px;
  border-radius: 999px;
  background: var(--accent);
  color: var(--ink);
  font: 700 6px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.gts-count {
  color: var(--dim);
  white-space: nowrap;
  font: 10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.gts-transport { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 8px; min-width: 0; }
.gts-transport-empty { color: var(--dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gts-tbtn {
  width: 26px;
  height: 26px;
  border-radius: 8px;
  background: var(--bg3);
  border: 1px solid var(--border);
  color: var(--text);
  font-size: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
}
.gts-tbtn:hover { background: var(--bg4); }
.gts-tbtn.play { background: var(--accent); border-color: var(--accent); color: var(--ink); font-weight: 700; }
.gts-tbtn.on { background: transparent; border-color: var(--accent); color: var(--accent); }
.gts-tbtn:disabled { opacity: 0.4; cursor: not-allowed; }
/* rewind/play/loop grouped into one segmented pill so the transport reads
   as a single unit (shared by the toolbar and the mini player) */
.gts-cluster {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 999px;
  flex: none;
}
.gts-cluster .gts-tbtn {
  width: 28px;
  height: 22px;
  border: 0;
  border-radius: 999px;
  background: transparent;
}
.gts-cluster .gts-tbtn:hover { background: var(--bg3); }
.gts-cluster .gts-tbtn.play { background: var(--accent); color: var(--ink); }
.gts-cluster .gts-tbtn.on { background: var(--accent-soft); color: var(--accent); }
.gts-time {
  font: 11px/1 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-variant-numeric: tabular-nums;
  color: var(--dim);
  white-space: nowrap;
}
.gts-time b { color: var(--text); font-weight: 600; }
.gts-speed { padding: 3px 4px; flex: none; }
.gts-transport-label {
  color: var(--dim);
  font: 11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 160px;
}

.gts-actions { grid-area: actions; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; justify-content: flex-end; }
/* thin divider isolating the destructive close button from the toggles */
.gts-vsep { width: 1px; height: 18px; background: var(--border); flex: none; }
.gts-abtn {
  padding: 5px 13px;
  border-radius: 999px;
  background: var(--bg3);
  border: 1px solid var(--border);
  color: var(--text);
  white-space: nowrap;
}
.gts-abtn:hover { background: var(--bg4); }
.gts-abtn.on { background: transparent; border-color: var(--accent); color: var(--accent); }
.gts-abtn:disabled { opacity: 0.4; cursor: not-allowed; }
.gts-abtn:disabled:hover { background: var(--bg3); }
.gts-abtn.gts-mini-btn { display: inline-flex; align-items: center; gap: 6px; }
.gts-abtn.gts-mini-btn svg { width: 13px; height: 13px; flex: none; }
.gts-close { color: var(--dim); font-size: 14px; padding: 4px 6px; }
.gts-close:hover { color: var(--text); }
.gts-coffee {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 13px;
  border-radius: 999px;
  background: var(--bg3);
  border: none;
  color: var(--text);
  white-space: nowrap;
  text-decoration: none;
}
.gts-coffee:hover { background: var(--bg4); }
.gts-coffee svg { width: 14px; height: 14px; flex: none; }

/* ---- body layout ---- */
/* overflow-x: once every column is at its min-width (tiny viewports with
   every panel open), the body scrolls sideways instead of clipping panels */
.gts-body { display: flex; flex: 1; min-height: 0; overflow-x: auto; }

/* ---- mobile section wrapper (list/tracks/properties/code) ----
   display: contents on desktop makes the wrapper invisible to layout, so
   the wrapped panel stays a direct flex child of .gts-body exactly as
   before; the header/collapse chrome only activates below the mobile
   breakpoint (see the 640px media query). */
.gts-section { display: contents; }
.gts-section-body { display: contents; }
.gts-section-head { display: none; }

/* ---- list view (width set inline from the listWidth signal, see
   store.js/ListView.js) ---- */
.gts-list {
  position: relative;
  flex: 0 1 auto;
  min-width: 130px;
  max-width: 40vw;
  border-right: 1px solid var(--border);
  background: var(--bg2);
  display: flex;
  flex-direction: column;
}
.gts-list-resize {
  position: absolute;
  top: 0;
  bottom: 0;
  right: -4px;
  width: 8px;
  cursor: ew-resize;
  z-index: 6;
}
.gts-list-resize:hover, .gts-list-resize:active { background: var(--accent-soft); }
.gts-list-rail {
  width: 28px;
  min-width: 28px;
  flex: none;
  align-items: center;
  padding-top: 8px;
}
.gts-list-head {
  flex: none;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px;
}
.gts-list-head + .gts-list-head { padding-top: 0; }
.gts-list-search { flex: 1; min-width: 0; }
.gts-list-engine-filter {
  flex: 1;
  min-width: 0;
  height: 22px;
  border-radius: 7px;
  background: var(--bg3);
  border: 1px solid var(--border);
  color: var(--text);
  font-size: 11px;
  padding: 0 4px;
}
.gts-list-collapse-btn {
  flex: none;
  width: 22px;
  height: 22px;
  border-radius: 7px;
  background: var(--bg3);
  border: 1px solid var(--border);
  color: var(--dim);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
}
.gts-list-collapse-btn:hover { background: var(--bg4); color: var(--text); }
.gts-list-rows { flex: 1; overflow-y: auto; }
.gts-list-row {
  padding: 6px 10px;
  cursor: pointer;
  border-left: 2px solid transparent;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.gts-list-row:hover { background: var(--bg3); }
.gts-list-row.on { background: var(--bg3); border-left-color: var(--accent); }
.gts-list-row.hover { background: var(--sel-soft); }
.gts-list-row-head { display: flex; align-items: flex-start; gap: 4px; min-width: 0; }
.gts-list-name-col { display: flex; flex-direction: column; gap: 1px; flex: 1; min-width: 0; }
.gts-list-caret {
  flex: none;
  width: 24px;
  height: 24px;
  border-radius: 7px;
  color: var(--dim);
  font-size: 18px;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.gts-list-caret.hide { visibility: hidden; }
.gts-list-caret:hover { color: var(--text); background: var(--bg4); }
/* reset button: strips whatever inline styles GSAP/WAAPI left on this row's
   real target(s) and stops it outright (see playback.js's resetNode) — only
   shown on row hover/focus so the row stays readable at rest, matching how
   the track view only reveals its own per-row chrome on hover. */
.gts-list-reset {
  flex: none;
  align-self: center;
  width: 22px;
  height: 22px;
  border-radius: 7px;
  color: var(--dim);
  font-size: 13px;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.12s ease;
}
.gts-list-row:hover .gts-list-reset,
.gts-list-row:focus-within .gts-list-reset,
.gts-list-reset:focus-visible {
  opacity: 1;
}
.gts-list-reset:hover { color: var(--text); background: var(--bg4); }
.gts-list-reset.spin { animation: gts-list-reset-spin 0.5s ease; }
@keyframes gts-list-reset-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.gts-list-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font: 500 12px -apple-system, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}
.gts-list-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 13px;
  height: 13px;
  margin-right: 4px;
  border-radius: 4px;
  font: 700 9px -apple-system, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  line-height: 1;
  vertical-align: 1px;
}
/* badge colours mirror the track blocks: timelines lavender, tweens sage */
.gts-list-badge-t { color: var(--ink); background: var(--sel); }
.gts-list-badge-a { color: var(--ink); background: var(--sage); }
.gts-list-meta { color: var(--dim); font-size: 10px; }
/* engine chip on every row: peach for CSS/WAAPI, sage green for GSAP,
   mirrors the peach/sage split on track blocks below */
.gts-list-engine {
  margin-left: 5px;
  padding: 1.5px 4px;
  border-radius: 4px;
  font: 700 8px -apple-system, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  letter-spacing: 0.04em;
  color: var(--ov);
  background: rgba(242, 185, 139, 0.16);
  vertical-align: 1px;
}
.gts-list-engine.gsap {
  color: var(--sage);
  background: rgba(147, 207, 174, 0.16);
}
.gts-list-engine.motion {
  color: var(--motion);
  background: rgba(242, 168, 201, 0.16);
}
.gts-list-empty { padding: 10px; color: var(--dim); font-style: italic; }

/* ---- track view ---- */
.gts-tracks { flex: 1; min-width: 160px; display: flex; flex-direction: column; background: var(--bg); }
.gts-tracks-scroll { flex: 1; overflow: auto; position: relative; }
.gts-tracks-content { position: relative; min-width: 100%; }
.gts-tracks-empty { padding: 18px 14px; color: var(--dim); }

.gts-row { display: flex; height: 32px; border-bottom: 1px solid rgba(51, 57, 72, 0.55); }
.gts-row.sel { background: rgba(201, 194, 242, 0.06); }
.gts-row.hover .gts-block { box-shadow: 0 0 0 1.5px var(--accent); }
.gts-row-label {
  position: sticky;
  left: 0;
  z-index: 3;
  width: 190px;
  flex: none;
  padding: 0 6px;
  display: flex;
  align-items: center;
  gap: 5px;
  background: var(--bg2);
  border-right: 1px solid var(--border);
  font: 11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  cursor: pointer;
}
.gts-row-name { flex: 1; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.gts-recon { flex: none; color: var(--ov); font-size: 11px; cursor: help; }

.gts-lane { position: relative; flex: 1; cursor: pointer; }
.gts-block {
  position: absolute;
  top: 5px;
  height: 22px;
  border-radius: 6px;
  background: var(--sage);
  border: 0;
  color: var(--ink);
  font-size: 10px;
  font-weight: 600;
  line-height: 22px;
  padding: 0 7px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  user-select: none;
  pointer-events: none;
}
.gts-block.timeline { background: var(--sel); }
.gts-block.ro { opacity: 0.75; }
/* css/waapi blocks render peach, motion pink, so all engines read apart at
   a glance */
.gts-block.css { background: var(--ov); }
.gts-block.css.timeline { background: rgba(242, 185, 139, 0.55); color: var(--text); }
.gts-block.motion { background: var(--motion); }

.gts-ruler-row { height: 24px; position: sticky; top: 0; z-index: 4; background: var(--bg); }
.gts-ruler-corner { height: 24px; z-index: 5; display: flex; align-items: center; }
.gts-markers-toggle {
  font: 600 9px/1 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: var(--dim);
  background: var(--bg3);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 3px 7px;
  white-space: nowrap;
}
.gts-markers-toggle:hover { background: var(--bg4); color: var(--text); }
.gts-markers-toggle.on { background: var(--accent-soft); border-color: var(--accent); color: var(--accent); }
.gts-ruler { background: var(--bg2); cursor: ew-resize; }
.gts-tick { position: absolute; bottom: 0; width: 1px; height: 6px; background: var(--border); pointer-events: none; }
.gts-tick.major { height: 10px; background: var(--dim); }
.gts-tick.major span {
  position: absolute;
  bottom: 8px;
  left: 3px;
  font-size: 9px;
  color: var(--dim);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

/* one shared playhead across the whole selected entry's tree, see
   Tracks.js: scrubbing happens on the ruler, not per row */
.gts-playhead {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1.5px;
  background: var(--text);
  z-index: 2;
  pointer-events: none;
}
.gts-playhead::before {
  content: "";
  position: absolute;
  top: 0;
  left: -4px;
  border: 4.5px solid transparent;
  border-top-color: var(--text);
}

.gts-label-marker {
  position: absolute;
  top: 24px;
  bottom: 0;
  width: 1px;
  background: var(--ov);
  z-index: 2;
  pointer-events: none;
}
.gts-label-tag {
  position: absolute;
  top: 0;
  left: 0;
  background: var(--ov);
  color: var(--ink);
  font: 600 10px/1 ui-monospace, Menlo, Consolas, monospace;
  padding: 3px 6px;
  border-radius: 0 6px 6px 0;
  white-space: nowrap;
}
/* intermediate @keyframes stops, rendered like timeline labels but quieter */
.gts-label-marker.kf { background: var(--dim); opacity: 0.7; }
.gts-label-marker.kf .gts-label-tag {
  background: var(--bg4);
  color: var(--dim);
  padding: 2px 4px;
  font-size: 9px;
}

/* ---- properties panel (width set inline from the propsWidth signal, see
   store.js/PropertiesPanel.js) ---- */
.gts-props {
  position: relative;
  flex: 0 1 auto;
  min-width: 150px;
  max-width: 60vw;
  border-left: 1px solid var(--border);
  background: var(--bg2);
  overflow-y: auto;
  padding-bottom: 10px;
}
.gts-props-head {
  padding: 8px 12px;
  font: 700 10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--dim);
  border-bottom: 1px solid var(--border);
  margin-bottom: 4px;
}
.gts-props-head small { text-transform: none; letter-spacing: 0; font-weight: 400; opacity: 0.75; margin-left: 4px; }
.gts-props-subhead {
  padding: 0 12px 6px;
  font: 700 10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--dim);
}
.gts-note { padding: 6px 12px; color: var(--dim); }
.gts-field {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 3px 12px;
}
.gts-field > label {
  width: 100px;
  max-width: 40%;
  flex: none;
  color: var(--dim);
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.gts-field .gts-static {
  flex: 1;
  min-width: 0;
  overflow-wrap: break-word;
}
.gts-static { color: var(--text); font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 11px; }
.gts-sep { border: 0; border-top: 1px solid var(--border); margin: 8px 0; }

/* ---- code panel (width set inline from the codeWidth signal, see
   store.js/CodePanel.js) ---- */
.gts-code {
  position: relative;
  flex: 0 1 auto;
  min-width: 170px;
  max-width: 60vw;
  border-left: 1px solid var(--border);
  background: var(--bg2);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}
.gts-chip-row { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 12px 8px; }
.gts-chip {
  padding: 3px 10px;
  border-radius: 999px;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.28);
  color: var(--text);
  font: 600 9px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.gts-code-var {
  padding: 0 12px 8px;
  color: var(--dim);
  font-size: 11px;
}
.gts-code-var code {
  color: var(--accent);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.gts-code-loc {
  padding: 0 12px 8px;
  color: var(--dim);
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.gts-code-pre {
  max-height: 320px;
  overflow: auto;
  margin: 0 12px 12px;
  padding: 12px;
  border-radius: 10px;
  background: var(--bg);
  border: 1px solid var(--border);
  font: 11px/1.6 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: var(--text);
  white-space: pre-wrap;
  word-break: break-word;
}
.gts-code-pre-wrap { position: relative; }
.gts-code-copy {
  position: absolute;
  top: 6px;
  right: 18px;
  z-index: 1;
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--bg3);
  border: 1px solid var(--border);
  color: var(--dim);
  font-size: 10px;
  line-height: 1.4;
}
.gts-code-copy:hover { background: var(--bg4); color: var(--text); }

/* ---- code panel collapsible HTML/CSS/JS sections ---- */
.gts-code-section { border-bottom: 1px solid var(--border); }
.gts-code-section:last-child { border-bottom: 0; }
.gts-code-section-head {
  width: 100%;
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding: 8px 12px;
  text-align: left;
  color: var(--text);
}
.gts-code-section-head:hover { background: var(--bg3); }
.gts-code-chevron {
  flex: none;
  width: 24px;
  height: 24px;
  color: var(--dim);
  font-size: 18px;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.gts-code-section-title {
  flex: none;
  font: 700 10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  text-transform: uppercase;
  letter-spacing: 0.14em;
}
.gts-code-section-head small { color: var(--dim); opacity: 0.75; font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gts-code-section-body { padding-top: 2px; }

/* ---- mini player: compact floating transport bar, bottom-center ----
   brand, animation picker + transport controls (the "body"), and maximise/
   close all share one row while the body fits between brand and actions,
   container-queried against the mini player's own (fixed) width rather
   than the viewport, since it doesn't span the viewport the way the
   toolbar does. Once the body no longer fits there, it drops to a full-
   width row of its own below brand/actions, and the animation picker
   grows to fill that row (controls sit on their own row under it). */
.gts-mini {
  position: fixed;
  left: 50%;
  bottom: 16px;
  transform: translateX(-50%);
  z-index: 8;
  display: flex;
  flex-direction: column;
  gap: 4px 8px;
  width: 900px;
  max-width: calc(100vw - 32px);
  padding: 8px 12px;
  border-radius: 24px;
  background: var(--bg2);
  border: 1px solid var(--border);
  color: var(--text);
  font: 12px/1.45 -apple-system, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.45);
  opacity: 0.92;
  transition: opacity 0.15s ease, box-shadow 0.15s ease;
  container-type: inline-size;
}
.gts-mini:hover { opacity: 1; box-shadow: 0 10px 34px rgba(0, 0, 0, 0.55); }
/* body (select + controls) always gets its own full-width row below
   brand/actions — the select and controls need to stay side by side, and
   they never actually fit alongside brand+actions in a single line at the
   mini player's own widths, so that arrangement doesn't get a mode of its
   own. */
.gts-mini-top {
  display: grid;
  grid-template-columns: auto 1fr auto;
  grid-template-areas: "brand body actions";
  align-items: center;
  gap: 6px 8px;
}
@container (max-width: 720px) {
  .gts-mini-top {
    grid-template-columns: 1fr auto;
    grid-template-areas: "brand actions" "body body";
  }
  .gts-mini-select { flex: 1 1 100%; max-width: none; }
  .gts-mini-controls { flex: 1 1 100%; justify-content: space-between; }
  .gts-mini-controls .gts-mini-scrub { flex: 1 1 auto; width: auto; }
}
.gts-mini-actions { grid-area: actions; display: flex; align-items: center; gap: 6px; }
.gts-mini-body { grid-area: body; display: flex; align-items: center; flex-wrap: nowrap; gap: 6px 8px; min-width: 0; }
/* transport controls kept to one line — once brand/body/actions no longer
   fit together, the body drops to its own full-width row instead (see the
   container query below) rather than wrapping mid-row */
.gts-mini-controls { display: flex; align-items: center; gap: 6px 8px; flex-wrap: nowrap; }
.gts-mini-select {
  flex: 0 1 auto;
  min-width: 70px;
  /* capped tight enough that select + controls still fit next to
     brand/actions on the mini player's default width (see the
     "single row until it doesn't fit" container query above) */
  max-width: 120px;
  height: 26px;
  border-radius: 999px;
  padding: 0 8px;
  font-size: 11px;
  text-overflow: ellipsis;
}
.gts-mini-scrub, .gts-transport-scrub {
  -webkit-appearance: none;
  appearance: none;
  flex: 1 1 90px;
  min-width: 60px;
  width: 150px;
  height: 4px;
  margin: 0 2px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: var(--bg4);
  cursor: ew-resize;
}
.gts-mini-scrub::-webkit-slider-thumb, .gts-transport-scrub::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--accent);
  border: 0;
}
.gts-mini-scrub::-moz-range-thumb, .gts-transport-scrub::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--accent);
  border: 0;
}
.gts-mini-scrub:disabled, .gts-transport-scrub:disabled { opacity: 0.4; cursor: not-allowed; }

/* ---- hover-to-highlight overlay ---- */
.gts-highlight-box {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 20;
  pointer-events: none;
  border: 1.5px solid var(--accent);
  background: var(--accent-soft);
  border-radius: 6px;
}

::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-thumb { background: var(--bg4); border-radius: 5px; border: 2px solid var(--bg); }
::-webkit-scrollbar-track { background: transparent; }

/* ---- responsive: progressively drop low-priority toolbar text so the
   controls never overlap. The panel spans the full viewport width, so plain
   viewport media queries are the right measure even inside the shadow
   root. ---- */
@media (max-width: 900px) {
  .gts-coffee-text { display: none; }
}
@media (max-width: 640px) {
  .gts-abtn-text { display: none; }
  .gts-coffee { display: none; }
  .gts-toolbar { padding: 6px 10px; gap: 6px 8px; }

  /* ---- gts-body: stack panels vertically, each full width, collapsible,
     independently scrollable instead of a cramped side-by-side layout ---- */
  .gts-body { flex-direction: column; overflow-x: hidden; overflow-y: auto; }
  .gts-section { display: block; width: 100%; }
  .gts-section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 8px 12px;
    background: var(--bg2);
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
    color: var(--text);
    font: 700 10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    text-transform: uppercase;
    letter-spacing: 0.14em;
  }
  .gts-section-body { display: block; }
  .gts-section-body.collapsed { display: none; }
  .gts-list, .gts-tracks, .gts-props, .gts-code {
    /* !important: .gts-props/.gts-code carry an inline width from the
       resize-handle signal (see PropertiesPanel.js/CodePanel.js), which
       otherwise beats this rule regardless of specificity */
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0;
    max-height: 42vh;
    flex: none;
    border-left: 0;
    border-right: 0;
  }

  .gts-field > label { width: 72px; }

  /* ---- mini player: 90% width on small viewports; the body/controls
     layout itself is handled by the container query above, since it
     tracks the mini player's own (fixed) width, not the viewport ---- */
  .gts-mini { left: 50%; width: 90%; max-width: 90vw; padding: 10px 12px; }
}
`;
