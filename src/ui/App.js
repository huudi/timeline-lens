import { html } from 'htm/preact';
import { useEffect } from 'preact/hooks';
import {
  uiRevealed,
  panelOpen,
  miniOpen,
  panelHeight,
  setPanelHeight,
  propsWidth,
  setPropsWidth,
  codeWidth,
  setCodeWidth,
  entries,
  selectedId,
  entryForNode,
  propertiesOpen,
  codeOpen,
  tick,
  loopIds,
  toggleLoop,
  findNode,
  mobileSectionCollapsed,
  toggleMobileSection,
} from '../store.js';
import { play, pause, seek, setSpeed, isPlaying, currentTime } from '../playback.js';
import { downloadEntriesAsJson } from '../export.js';
import { ListView } from './ListView.js';
import { TrackView } from './Tracks.js';
import { PropertiesPanel } from './PropertiesPanel.js';
import { CodePanel } from './CodePanel.js';
import { fmtTime } from './util.js';

function Logo() {
  return html`
    <svg viewBox="0 0 568.6 568.7" fill="currentColor">
      <path d="M534.3,337.4c33.8-.7,25-41.4,26-63.4-.8-38.5-56.1-23-79.9-26-2,31.2-9.8,61.4-23,89.4h76.9Z"/>
      <path d="M323.6,337.4c25.6-22.4,43.1-53.9,47.3-89.4h-137.1c-14.4,0-26,11.6-26,26v37.4c0,14.4,11.6,26,26,26h89.8Z"/>
      <path d="M325.7,193.2c-1-22.1,7.8-62.7-26-63.4,0,0-165.7,0-165.7,0-24,23-39.9,54.4-43,89.4h208.6c14.4,0,26-11.6,26-26Z"/>
      <path d="M565.1,518.2c-34.7-42.8-109.6-110.3-147.5-150.7,83.1-109.6,43.6-277-76.4-338.9C96.3-97.1-123.4,221.9,80.3,405.9c77.8,69.7,203.4,75,287.1,11.9l140.4,140.5h0c27.8,27.9,73.9-4.9,57.3-40.1ZM219,390.7C35.7,372.8,18.5,116.2,199.3,74.9c127.4-27.4,234.8,109.4,175,227.5-27.8,57.4-91.8,93.9-155.3,88.2Z"/>
    </svg>
  `;
}

// Huudi wordmark, used wherever the "Timeline Lens" brand identity is
// shown (toolbar + mini player) — always rendered in white regardless of
// theme, per the brand SVG supplied by huudi.
function BrandLogo() {
  return html`
    <svg class="gts-brand-logo" viewBox="0 0 1261.1 118.3" fill="#fff" aria-label="Timeline Studio">
      <path d="M74.4,18.8v97h-17.5V18.8H0V2.4h131.2v16.4h-56.9Z"/>
      <path d="M141.7,20.6V1.1h17.5v19.4h-17.5ZM141.7,115.8V31.4l17.5-1.9v86.3h-17.5Z"/>
      <path d="M174.6,115.8V31.4l16.8-1.9.5,8.3.2.2c11.2-5.3,21.7-9.6,34.7-9.6s29,4.7,36.3,12.3c12.6-6.8,31.1-12.3,44.2-12.3,36,0,47.1,19,47.1,44.4v43.1h-17.5v-42.9c0-16.2-5-28.4-31.4-28.4s-26.2,4.4-35.8,8.3c2.4,5.8,3.6,12.6,3.6,19.9v43.1h-17.5v-42.9c0-16.2-4.2-28.4-30.5-28.4s-24.8,4.4-33.2,7.6v63.7h-17.5Z"/>
      <path d="M382.1,80.5c3.2,14.1,17.2,21.5,44.7,21.5s41.6-4.4,46.3-5.8l3.4,15.2c-5.7,2.1-25.6,6.8-49.1,6.8-42.9,0-64.2-15.7-64.2-44.4s18.5-45.5,56.9-45.5,66.1,17.3,55.1,52.2h-93.2ZM458.3,67.4c2.6-15.6-13.4-23.2-37.3-23.2s-36,9.7-39.2,23.2h76.5Z"/>
      <path d="M490.4,1.9l17.5-1.9v115.8h-17.5V1.9Z"/>
      <path d="M523.7,20.6V1.1h17.5v19.4h-17.5ZM523.7,115.8V31.4l17.5-1.9v86.3h-17.5Z"/>
      <path d="M653,115.8v-42.9c0-16.2-8.7-28.4-36.5-28.4s-29.8,3.9-42.4,7.6v63.7h-17.5V31.4l16.8-1.9.5,8.3.2.2c12.3-5.2,26.9-9.6,44.2-9.6,37.1,0,52.2,19,52.2,44.4v43.1h-17.5Z"/>
      <path d="M698.2,80.5c3.2,14.1,17.2,21.5,44.7,21.5s41.6-4.4,46.3-5.8l3.4,15.2c-5.7,2.1-25.6,6.8-49.1,6.8-42.9,0-64.2-15.7-64.2-44.4s18.5-45.5,56.9-45.5,66.1,17.3,55.1,52.2h-93.2ZM774.3,67.4c2.6-15.6-13.4-23.2-37.3-23.2s-36,9.7-39.2,23.2h76.5Z"/>
      <path d="M868.9,1.9l17.5-1.9v115.8h-17.5V1.9Z"/>
      <path d="M914.6,80.5c3.2,14.1,17.2,21.5,44.7,21.5s41.6-4.4,46.3-5.8l3.4,15.2c-5.7,2.1-25.6,6.8-49.1,6.8-42.9,0-64.2-15.7-64.2-44.4s18.5-45.5,56.9-45.5,66.1,17.3,55.1,52.2h-93.2ZM990.8,67.4c2.6-15.6-13.4-23.2-37.3-23.2s-36,9.7-39.2,23.2h76.5Z"/>
      <path d="M1118.7,115.8v-42.9c0-16.2-8.7-28.4-36.5-28.4s-29.8,3.9-42.4,7.6v63.7h-17.5V31.4l16.8-1.9.5,8.3.2.2c12.3-5.2,26.9-9.6,44.2-9.6,37.1,0,52.2,19,52.2,44.4v43.1h-17.5Z"/>
      <path d="M1148.6,95.1c22.5,5.2,36,7,53.1,7s41.6-1,41.6-12-19.1-9.6-39.9-9.7c-26.2-.6-56.2-2.4-56.2-24.9s35.3-27.1,54.6-27.1,33,1.6,51.8,4.9l-2.9,16.2c-20.1-3.6-34-4.7-52-4.7s-33.7,1.1-33.7,10.7,17.8,9.6,37.9,9.7c26.6.3,58.2,1.3,58.2,24.8s-44.4,28.4-61.4,28.4-33.4-1.8-54.6-7.1l3.4-16Z"/>
    </svg>
  `;
}

// Brand block shared by the toolbar and mini player: the huudi wordmark and
// a small "Beta" pill badged onto the logo's top-right corner.
function Brand() {
  return html`
    <div class="gts-brand">
      <div class="gts-brand-mark">
        <${BrandLogo} />
        <span class="gts-beta">Beta</span>
      </div>
    </div>
  `;
}

function ResizeHandle({ onDrag }) {
  const onPointerDown = (e) => {
    e.preventDefault();
    const start = e.clientY;
    const move = (ev) => onDrag(ev.clientY - start);
    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  };
  return html`<div class="gts-panel-resize" onPointerDown=${onPointerDown}></div>`;
}

// Controls the top-level entry containing the current selection, not the
// selected node itself, nested children are positioned inside that same
// instance, so this is the one thing that's actually meaningful to
// play/pause/scrub/speed as a whole (see Tracks.js's ruler scrub).
function Transport() {
  tick.value; // keep the time readout live
  const entry = entryForNode(selectedId.value);
  if (!entry) {
    return html`<div class="gts-transport gts-transport-empty">Select an animation to control playback</div>`;
  }
  const playing = isPlaying(entry);
  const t = Math.min(entry.duration, currentTime(entry));
  const loops = entry.repeat === -1;
  const looping = loopIds.value.has(entry.id);
  return html`
    <div class="gts-transport">
      <div class="gts-cluster">
        <button class="gts-tbtn" title="Rewind" onClick=${() => seek(entry, 0)}>⏮</button>
        <button
          class="gts-tbtn play"
          title=${playing ? 'Pause' : 'Play'}
          onClick=${() => (playing ? pause(entry) : play(entry))}
        >
          ${playing ? '❚❚' : '▶'}
        </button>
        <button
          class="gts-tbtn ${looping ? 'on' : ''}"
          title=${loops ? 'Already repeats infinitely' : looping ? 'Loop: on, replays on completion' : 'Loop: off'}
          disabled=${loops}
          onClick=${() => toggleLoop(entry.id)}
        >
          ↻
        </button>
      </div>
      <input
        class="gts-transport-scrub"
        type="range"
        min="0"
        max=${entry.duration || 0}
        step=${entry.progressDomain ? 0.001 : 0.01}
        value=${t}
        onInput=${(e) => seek(entry, parseFloat(e.target.value))}
      />
      <span class="gts-time"
        ><b>${fmtTime(entry, t)}</b> / ${entry.repeat === -1 ? '∞' : fmtTime(entry, entry.duration)}</span
      >
      <select
        class="gts-speed"
        title="Preview playback speed"
        onChange=${(e) => setSpeed(entry, parseFloat(e.target.value))}
      >
        <option value="0.25">0.25×</option>
        <option value="0.5">0.5×</option>
        <option value="1" selected>1×</option>
        <option value="1.5">1.5×</option>
        <option value="2">2×</option>
      </select>
      <span class="gts-transport-label" title=${entry.label}>${entry.label}</span>
    </div>
  `;
}

// Play button in a circle, the mini player's own mark (vs. the bare Logo
// triangle that opens the full panel).
function MiniPlayerIcon() {
  return html`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M10 8.5 15.5 12 10 15.5Z" fill="currentColor" stroke="none" />
    </svg>
  `;
}

function ExportIcon() {
  return html`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M4 20h16" />
    </svg>
  `;
}

// First real DOM element among a node's targets (walking into timeline
// children), so picking an animation in the mini player can scroll the page
// to where that animation actually happens — the mini player exists exactly
// because the page, not the panel, is what's being watched.
function scrollAnimationIntoView(id) {
  const stack = [findNode(id)].filter(Boolean);
  while (stack.length) {
    const node = stack.shift();
    for (const t of node.targets || []) {
      if (typeof Element !== 'undefined' && t instanceof Element && t.isConnected) {
        t.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
    }
    stack.push(...(node.children || []));
  }
}

// Compact floating transport bar hovering at the bottom of the page: an
// animation dropdown plus the same playback controls as the toolbar
// Transport, for scrubbing the page's animations without the full panel
// taking up the viewport. Selection is shared with the panel (selectedId),
// so expanding back to the full panel keeps the same animation in focus.
function MiniPlayer() {
  tick.value; // keep the time readout and scrubber live
  const all = entries.value;
  const entry = entryForNode(selectedId.value) || all[0] || null;
  const playing = entry ? isPlaying(entry) : false;
  const t = entry ? Math.min(entry.duration, currentTime(entry)) : 0;
  const looping = entry ? loopIds.value.has(entry.id) : false;
  const loops = entry ? entry.repeat === -1 : false;
  return html`
    <div class="gts-mini">
      <div class="gts-mini-top">
        <${Brand} />
        <div class="gts-mini-body">
          <select
            class="gts-mini-select"
            title="Choose an animation"
            value=${entry?.id || ''}
            onChange=${(e) => {
              selectedId.value = e.target.value;
              scrollAnimationIntoView(e.target.value);
            }}
          >
            ${all.length ? null : html`<option value="">No animations detected</option>`}
            ${all.map((a) => html`<option key=${a.id} value=${a.id}>${a.label}</option>`)}
          </select>
          <div class="gts-mini-controls">
            <div class="gts-cluster">
              <button class="gts-tbtn" title="Rewind" disabled=${!entry} onClick=${() => entry && seek(entry, 0)}>⏮</button>
              <button
                class="gts-tbtn play"
                title=${playing ? 'Pause' : 'Play'}
                disabled=${!entry}
                onClick=${() => entry && (playing ? pause(entry) : play(entry))}
              >
                ${playing ? '❚❚' : '▶'}
              </button>
              <button
                class="gts-tbtn ${looping ? 'on' : ''}"
                title=${loops ? 'Already repeats infinitely' : looping ? 'Loop: on, replays on completion' : 'Loop: off'}
                disabled=${!entry || loops}
                onClick=${() => entry && toggleLoop(entry.id)}
              >
                ↻
              </button>
            </div>
            <input
              class="gts-mini-scrub"
              type="range"
              min="0"
              max=${entry ? entry.duration || 0 : 0}
              step=${entry?.progressDomain ? 0.001 : 0.01}
              value=${t}
              disabled=${!entry}
              onInput=${(e) => entry && seek(entry, parseFloat(e.target.value))}
            />
            <select
              class="gts-speed"
              title="Preview playback speed"
              disabled=${!entry}
              onChange=${(e) => entry && setSpeed(entry, parseFloat(e.target.value))}
            >
              <option value="0.25">0.25×</option>
              <option value="0.5">0.5×</option>
              <option value="1" selected>1×</option>
              <option value="1.5">1.5×</option>
              <option value="2">2×</option>
            </select>
            <span class="gts-time"
              ><b>${entry ? fmtTime(entry, t) : '—'}</b> /
              ${entry ? (entry.repeat === -1 ? '∞' : fmtTime(entry, entry.duration)) : '—'}</span
            >
          </div>
        </div>
        <div class="gts-mini-actions">
          <button
            class="gts-tbtn"
            title="Expand to the full panel"
            onClick=${() => {
              miniOpen.value = false;
              panelOpen.value = true;
            }}
          >
            ⤢
          </button>
          <span class="gts-vsep" aria-hidden="true"></span>
          <button class="gts-close" title="Close the mini player" onClick=${() => (miniOpen.value = false)}>✕</button>
        </div>
      </div>
    </div>
  `;
}

function Toolbar() {
  const count = entries.value.length;
  return html`
    <div class="gts-toolbar">
      <div class="gts-toolbar-top">
        <div class="gts-brand-group">
          <${Brand} />
          <span class="gts-count">${count} animation${count === 1 ? '' : 's'} detected</span>
        </div>
        <div class="gts-toolbar-transport">
          <${Transport} />
        </div>
        <div class="gts-actions">
          <button
            class="gts-abtn gts-mini-btn"
            title="Switch to the mini player — a compact floating transport bar"
            onClick=${() => {
              miniOpen.value = true;
              panelOpen.value = false;
            }}
          >
            <${MiniPlayerIcon} /><span class="gts-abtn-text">Mini player</span>
          </button>
          <button
            class="gts-abtn ${propertiesOpen.value ? 'on' : ''}"
            title="Toggle the properties panel"
            onClick=${() => (propertiesOpen.value = !propertiesOpen.value)}
          >
            ▤<span class="gts-abtn-text"> Properties</span>
          </button>
          <button
            class="gts-abtn ${codeOpen.value ? 'on' : ''}"
            title="Toggle the code panel"
            onClick=${() => (codeOpen.value = !codeOpen.value)}
          >
            ${'{ }'}<span class="gts-abtn-text"> Code</span>
          </button>
          <button
            class="gts-abtn gts-mini-btn"
            title="Export the detected animations as JSON"
            disabled=${!count}
            onClick=${() => downloadEntriesAsJson(entries.value)}
          >
            <${ExportIcon} /><span class="gts-abtn-text">Export</span>
          </button>
          <a
            class="gts-coffee"
            href="https://buymeacoffee.com/huudi"
            target="_blank"
            rel="noopener noreferrer"
            title="Buy me a coffee"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
              <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
              <line x1="6" y1="2" x2="6" y2="4" />
              <line x1="10" y1="2" x2="10" y2="4" />
              <line x1="14" y1="2" x2="14" y2="4" />
            </svg>
            <span class="gts-coffee-text">Buy me a coffee</span>
          </a>
          <span class="gts-vsep" aria-hidden="true"></span>
          <button class="gts-close" title="Close" onClick=${() => (panelOpen.value = false)}>✕</button>
        </div>
      </div>
    </div>
  `;
}

// Wraps a gts-body panel with a header/chevron that's only shown once the
// panels stack vertically on mobile (see .gts-section in styles.js) — on
// wider layouts it's `display: contents` and disappears entirely, leaving
// the wrapped panel as a direct flex child same as before.
function MobileSection({ id, title, children }) {
  const collapsed = mobileSectionCollapsed.value.has(id);
  return html`
    <div class="gts-section">
      <button class="gts-section-head" onClick=${() => toggleMobileSection(id)}>
        <span class="gts-section-title">${title}</span>
        <span class="gts-code-chevron">${collapsed ? '▸' : '▾'}</span>
      </button>
      <div class="gts-section-body ${collapsed ? 'collapsed' : ''}">${children}</div>
    </div>
  `;
}

function Panel() {
  const startHeight = panelHeight.value;
  return html`
    <div class="gts-panel" style="height:${panelHeight.value}px">
      <${ResizeHandle} onDrag=${(dy) => setPanelHeight(startHeight - dy)} />
      <${Toolbar} />
      <div class="gts-body">
        <${MobileSection} id="list" title="Animations">
          <${ListView} />
        <//>
        <${MobileSection} id="tracks" title="Timeline">
          <${TrackView} />
        <//>
        ${propertiesOpen.value
          ? html`<${MobileSection} id="properties" title="Properties"><${PropertiesPanel} /><//>`
          : null}
        ${codeOpen.value ? html`<${MobileSection} id="code" title="Code"><${CodePanel} /><//>` : null}
      </div>
    </div>
  `;
}

// True while focus is somewhere text could be typed — the host page's own
// inputs as much as the panel's search box — so Space/Esc don't hijack
// keystrokes meant for a field instead of the transport.
function isTypingTarget(target) {
  if (!target) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

// Space: play/pause the current selection. Esc: close whichever surface is
// open (mini player first, since it's the lighter one). Both are scoped to
// while the panel or mini player is actually open, so they never hijack the
// host page's own keystrokes when the studio isn't in view.
function useKeyboardShortcuts() {
  useEffect(() => {
    const onKeyDown = (e) => {
      if (!panelOpen.value && !miniOpen.value) return;
      // e.composedPath()[0] is the true origin inside the shadow root;
      // e.target is always the shadow host itself for a composed event.
      if (isTypingTarget(e.composedPath()[0])) return;

      if (e.code === 'Space' || e.key === ' ') {
        const entry = entryForNode(selectedId.value);
        if (!entry) return;
        e.preventDefault();
        isPlaying(entry) ? pause(entry) : play(entry);
      } else if (e.key === 'Escape') {
        if (miniOpen.value) miniOpen.value = false;
        else panelOpen.value = false;
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);
}

export function App() {
  useKeyboardShortcuts();
  // Nothing at all — not even the trigger button — while a host page has
  // asked to stay hidden (init({ hidden: true }), see index.js's reveal()).
  // Detection itself (rescan/ticker/etc., all wired up in index.js's own
  // mount(), independent of what App() renders) keeps running regardless;
  // this only gates the UI.
  if (!uiRevealed.value) return null;
  // the mini player replaces the trigger the same way the full panel does —
  // only one of trigger/panel/mini should ever be on screen at once
  const hideTrigger = panelOpen.value || miniOpen.value;
  return html`
    <div>
      <button
        class="gts-trigger ${hideTrigger ? 'open' : ''}"
        style=${panelOpen.value ? `bottom:${panelHeight.value + 16}px` : ''}
        title="Timeline Lens"
        onClick=${() => (panelOpen.value = !panelOpen.value)}
      >
        ${panelOpen.value ? '✕' : html`<${Logo} />`}
      </button>
      ${panelOpen.value ? html`<${Panel} />` : null}
      ${miniOpen.value && !panelOpen.value ? html`<${MiniPlayer} />` : null}
    </div>
  `;
}
