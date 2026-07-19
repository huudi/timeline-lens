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
import { fmtTime, ChevronRightIcon, ChevronDownIcon, RepeatIcon } from './util.js';

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

// Brand block shared by the toolbar and mini player: the huudi wordmark.
function Brand() {
  return html`
    <div class="gts-brand">
      <div class="gts-brand-mark">
        <${BrandLogo} />
      </div>
    </div>
  `;
}

function ResizeHandle({ onDrag }) {
  const onPointerDown = (e) => {
    e.preventDefault();
    e.target.setPointerCapture?.(e.pointerId);
    const start = e.clientY;
    const prevCursor = document.body.style.cursor;
    document.body.style.cursor = 'ns-resize';
    const move = (ev) => {
      ev.preventDefault();
      onDrag(ev.clientY - start);
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
        <button class="gts-tbtn" title="Rewind" onClick=${() => seek(entry, 0)}><${RewindIcon} /></button>
        <button
          class="gts-tbtn play"
          title=${playing ? 'Pause' : 'Play'}
          onClick=${() => (playing ? pause(entry) : play(entry))}
        >
          ${playing ? html`<${PauseIcon} />` : html`<${PlayIcon} />`}
        </button>
        <button
          class="gts-tbtn ${looping ? 'on' : ''}"
          title=${loops ? 'Already repeats infinitely' : looping ? 'Loop: on, replays on completion' : 'Loop: off'}
          disabled=${loops}
          onClick=${() => toggleLoop(entry.id)}
        >
          <${RepeatIcon} />
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
// triangle that opens the full panel). reicon.dev/icons/play-circle (outline).
function MiniPlayerIcon() {
  return html`
    <svg viewBox="0 0 24 24" fill="none">
      <path fill-rule="evenodd" clip-rule="evenodd" d="M11.0748 7.50835C9.74622 6.72395 8.25 7.79065 8.25 9.21316V14.7868C8.25 16.2093 9.74622 17.276 11.0748 16.4916L15.795 13.7048C17.0683 12.953 17.0683 11.047 15.795 10.2952L11.0748 7.50835ZM9.75 9.21316C9.75 9.01468 9.84615 8.87585 9.95947 8.80498C10.0691 8.73641 10.1919 8.72898 10.3122 8.80003L15.0324 11.5869C15.165 11.6652 15.25 11.8148 15.25 12C15.25 12.1852 15.165 12.3348 15.0324 12.4131L10.3122 15.2C10.1919 15.271 10.0691 15.2636 9.95947 15.195C9.84615 15.1242 9.75 14.9853 9.75 14.7868V9.21316Z" fill="currentColor"/>
      <path fill-rule="evenodd" clip-rule="evenodd" d="M12 1.25C6.06294 1.25 1.25 6.06294 1.25 12C1.25 17.9371 6.06294 22.75 12 22.75C17.9371 22.75 22.75 17.9371 22.75 12C22.75 6.06294 17.9371 1.25 12 1.25ZM2.75 12C2.75 6.89137 6.89137 2.75 12 2.75C17.1086 2.75 21.25 6.89137 21.25 12C21.25 17.1086 17.1086 21.25 12 21.25C6.89137 21.25 2.75 17.1086 2.75 12Z" fill="currentColor"/>
    </svg>
  `;
}

// reicon.dev/icons/download (outline).
function ExportIcon() {
  return html`
    <svg viewBox="0 0 24 24" fill="none">
      <path fill-rule="evenodd" clip-rule="evenodd" d="M12 1.25C12.4142 1.25 12.75 1.58579 12.75 2V12.9726L14.4306 11.0119C14.7001 10.6974 15.1736 10.661 15.4881 10.9306C15.8026 11.2001 15.839 11.6736 15.5694 11.9881L12.5694 15.4881C12.427 15.6543 12.2189 15.75 12 15.75C11.7811 15.75 11.573 15.6543 11.4306 15.4881L8.43056 11.9881C8.16099 11.6736 8.19741 11.2001 8.51191 10.9306C8.8264 10.661 9.29988 10.6974 9.56944 11.0119L11.25 12.9726V2C11.25 1.58579 11.5858 1.25 12 1.25ZM6.99583 8.25196C7.41003 8.24966 7.74768 8.58357 7.74999 8.99778C7.7523 9.41199 7.41838 9.74964 7.00418 9.75194C5.91068 9.75803 5.1356 9.78643 4.54735 9.89448C3.98054 9.99859 3.65246 10.1658 3.40901 10.4092C3.13225 10.686 2.9518 11.0746 2.85315 11.8083C2.75159 12.5637 2.75 13.5648 2.75 15.0002V16.0002C2.75 17.4356 2.75159 18.4367 2.85315 19.1921C2.9518 19.9259 3.13225 20.3144 3.40901 20.5912C3.68577 20.868 4.07435 21.0484 4.80812 21.1471C5.56347 21.2486 6.56458 21.2502 8 21.2502H16C17.4354 21.2502 18.4365 21.2486 19.1919 21.1471C19.9257 21.0484 20.3142 20.868 20.591 20.5912C20.8678 20.3144 21.0482 19.9259 21.1469 19.1921C21.2484 18.4367 21.25 17.4356 21.25 16.0002V15.0002C21.25 13.5648 21.2484 12.5637 21.1469 11.8083C21.0482 11.0746 20.8678 10.686 20.591 10.4092C20.3475 10.1658 20.0195 9.99859 19.4527 9.89448C18.8644 9.78643 18.0893 9.75803 16.9958 9.75194C16.5816 9.74964 16.2477 9.41199 16.25 8.99778C16.2523 8.58357 16.59 8.24966 17.0042 8.25196C18.0857 8.25799 18.9871 8.28387 19.7236 8.41916C20.4816 8.55839 21.1267 8.82364 21.6517 9.34857C22.2536 9.95048 22.5125 10.7084 22.6335 11.6085C22.75 12.4754 22.75 13.5778 22.75 14.9453V16.0551C22.75 17.4227 22.75 18.525 22.6335 19.392C22.5125 20.2921 22.2536 21.0499 21.6517 21.6519C21.0497 22.2538 20.2919 22.5127 19.3918 22.6337C18.5248 22.7503 17.4225 22.7502 16.0549 22.7502H7.94513C6.57754 22.7502 5.47522 22.7503 4.60825 22.6337C3.70814 22.5127 2.95027 22.2538 2.34835 21.6519C1.74643 21.0499 1.48754 20.2921 1.36652 19.392C1.24996 18.525 1.24998 17.4227 1.25 16.0551V14.9453C1.24998 13.5778 1.24996 12.4754 1.36652 11.6085C1.48754 10.7084 1.74643 9.95048 2.34835 9.34857C2.87328 8.82363 3.51835 8.55839 4.27635 8.41916C5.01291 8.28387 5.9143 8.25798 6.99583 8.25196Z" fill="currentColor"/>
    </svg>
  `;
}

// reicon.dev/icons/play (filled).
function PlayIcon() {
  return html`
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M21.4086 9.35258C23.5305 10.5065 23.5305 13.4935 21.4086 14.6474L8.59662 21.6145C6.53435 22.736 4 21.2763 4 18.9671L4 5.0329C4 2.72368 6.53435 1.26402 8.59661 2.38548L21.4086 9.35258Z" fill="currentColor"/>
    </svg>
  `;
}

// reicon.dev/icons/pause (filled).
function PauseIcon() {
  return html`
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M2 6C2 4.11438 2 3.17157 2.58579 2.58579C3.17157 2 4.11438 2 6 2C7.88562 2 8.82843 2 9.41421 2.58579C10 3.17157 10 4.11438 10 6V18C10 19.8856 10 20.8284 9.41421 21.4142C8.82843 22 7.88562 22 6 22C4.11438 22 3.17157 22 2.58579 21.4142C2 20.8284 2 19.8856 2 18V6Z" fill="currentColor"/>
      <path d="M14 6C14 4.11438 14 3.17157 14.5858 2.58579C15.1716 2 16.1144 2 18 2C19.8856 2 20.8284 2 21.4142 2.58579C22 3.17157 22 4.11438 22 6V18C22 19.8856 22 20.8284 21.4142 21.4142C20.8284 22 19.8856 22 18 22C16.1144 22 15.1716 22 14.5858 21.4142C14 20.8284 14 19.8856 14 18V6Z" fill="currentColor"/>
    </svg>
  `;
}

// reicon.dev/icons/rewind (outline).
function RewindIcon() {
  return html`
    <svg viewBox="0 0 24 24" fill="none">
      <path fill-rule="evenodd" clip-rule="evenodd" d="M22.7498 6.42642C22.7498 5.28953 22.2555 4.2991 21.4787 3.73235C20.6815 3.15078 19.6076 3.04585 18.6712 3.69083L18.6624 3.69687L13.75 7.2906V7.12313C13.75 6.08735 13.2773 5.18999 12.5457 4.68051C11.7998 4.16104 10.8013 4.06826 9.92676 4.64326L2.50932 9.52023C1.639 10.0925 1.25 11.0822 1.25 12.0001C1.25 12.918 1.63899 13.9077 2.50931 14.48L9.92676 19.3569C10.8013 19.9319 11.7998 19.8392 12.5457 19.3197C13.2773 18.8102 13.75 17.9129 13.75 16.8771V16.7096L18.6624 20.3033L18.6712 20.3094C19.6076 20.9544 20.6815 20.8494 21.4787 20.2679C22.2555 19.7011 22.7498 18.7107 22.7498 17.5738L22.7498 6.42642ZM13.75 14.8511L19.5298 19.0794C19.8935 19.3258 20.2682 19.2942 20.5946 19.0561C20.9437 18.8014 21.2498 18.2843 21.2498 17.5738L21.2498 6.42642C21.2498 5.71593 20.9437 5.19882 20.5946 4.94415C20.2682 4.706 19.8935 4.67439 19.5299 4.92083L13.75 9.14914L13.75 14.8511ZM10.7508 5.89661C11.0703 5.68659 11.4024 5.71218 11.6885 5.91145C11.989 6.12071 12.25 6.54246 12.25 7.12313L12.25 16.8771C12.25 17.4577 11.989 17.8795 11.6885 18.0888C11.4024 18.288 11.0703 18.3136 10.7508 18.1036L3.33339 13.2266C2.97524 12.9911 2.75 12.5316 2.75 12.0001C2.75 11.4686 2.97524 11.0091 3.3334 10.7736L10.7508 5.89661Z" fill="currentColor"/>
    </svg>
  `;
}

// reicon.dev/icons/maximize2 (outline) — used for the mini player's "expand
// to full panel" action.
function ExpandIcon() {
  return html`
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M2 9.98V9C2 4 4 2 9 2H15C20 2 22 4 22 9V15C22 20 20 22 15 22H14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M13 11L18.01 5.97998H14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M18.01 5.97998V9.98998" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M11 16.15V18.85C11 21.1 10.1 22 7.85 22H5.15C2.9 22 2 21.1 2 18.85V16.15C2 13.9 2.9 13 5.15 13H7.85C10.1 13 11 13.9 11 16.15Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
}

// reicon.dev/icons/x (outline).
function CloseIcon() {
  return html`
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M18.4697 19.5303C18.7626 19.8232 19.2374 19.8232 19.5303 19.5303C19.8232 19.2374 19.8232 18.7626 19.5303 18.4697L13.0607 12L19.5303 5.53033C19.8232 5.23744 19.8232 4.76256 19.5303 4.46967C19.2374 4.17678 18.7626 4.17678 18.4697 4.46967L12 10.9393L5.53033 4.46967C5.23744 4.17678 4.76256 4.17678 4.46967 4.46967C4.17678 4.76256 4.17678 5.23744 4.46967 5.53033L10.9393 12L4.46967 18.4697C4.17678 18.7626 4.17678 19.2374 4.46967 19.5303C4.76256 19.8232 5.23744 19.8232 5.53033 19.5303L12 13.0607L18.4697 19.5303Z" fill="currentColor"/>
    </svg>
  `;
}

// reicon.dev/icons/tuning-square2 (outline) — properties panel toggle.
function ListIcon() {
  return html`
    <svg viewBox="0 0 24 24" fill="none">
      <path fill-rule="evenodd" clip-rule="evenodd" d="M7.25 16C7.25 14.4812 8.48122 13.25 10 13.25C11.5188 13.25 12.75 14.4812 12.75 16C12.75 17.5188 11.5188 18.75 10 18.75C8.48122 18.75 7.25 17.5188 7.25 16ZM10 14.75C9.30964 14.75 8.75 15.3096 8.75 16C8.75 16.6904 9.30964 17.25 10 17.25C10.6904 17.25 11.25 16.6904 11.25 16C11.25 15.3096 10.6904 14.75 10 14.75Z" fill="currentColor"/>
      <path fill-rule="evenodd" clip-rule="evenodd" d="M16.75 8C16.75 9.51878 15.5188 10.75 14 10.75C12.4812 10.75 11.25 9.51878 11.25 8C11.25 6.48122 12.4812 5.25 14 5.25C15.5188 5.25 16.75 6.48122 16.75 8ZM14 9.25C14.6904 9.25 15.25 8.69036 15.25 8C15.25 7.30964 14.6904 6.75 14 6.75C13.3096 6.75 12.75 7.30964 12.75 8C12.75 8.69036 13.3096 9.25 14 9.25Z" fill="currentColor"/>
      <path d="M13.25 16C13.25 15.5858 13.5858 15.25 14 15.25H19C19.4142 15.25 19.75 15.5858 19.75 16C19.75 16.4142 19.4142 16.75 19 16.75H14C13.5858 16.75 13.25 16.4142 13.25 16Z" fill="currentColor"/>
      <path d="M10 7.25C10.4142 7.25 10.75 7.58579 10.75 8C10.75 8.41421 10.4142 8.75 10 8.75H5C4.58579 8.75 4.25 8.41421 4.25 8C4.25 7.58579 4.58579 7.25 5 7.25H10Z" fill="currentColor"/>
      <path d="M4.25 16C4.25 15.5858 4.58579 15.25 5 15.25H6C6.41421 15.25 6.75 15.5858 6.75 16C6.75 16.4142 6.41421 16.75 6 16.75H5C4.58579 16.75 4.25 16.4142 4.25 16Z" fill="currentColor"/>
      <path d="M19 7.25C19.4142 7.25 19.75 7.58579 19.75 8C19.75 8.41421 19.4142 8.75 19 8.75H18C17.5858 8.75 17.25 8.41421 17.25 8C17.25 7.58579 17.5858 7.25 18 7.25H19Z" fill="currentColor"/>
      <path fill-rule="evenodd" clip-rule="evenodd" d="M11.9426 1.25H12.0574C14.3658 1.24999 16.1748 1.24998 17.5863 1.43975C19.031 1.63399 20.1711 2.03933 21.0659 2.93414C21.9607 3.82895 22.366 4.96897 22.5603 6.41371C22.75 7.82519 22.75 9.63423 22.75 11.9426V12.0574C22.75 14.3658 22.75 16.1748 22.5603 17.5863C22.366 19.031 21.9607 20.1711 21.0659 21.0659C20.1711 21.9607 19.031 22.366 17.5863 22.5603C16.1748 22.75 14.3658 22.75 12.0574 22.75H11.9426C9.63423 22.75 7.82519 22.75 6.41371 22.5603C4.96897 22.366 3.82895 21.9607 2.93414 21.0659C2.03933 20.1711 1.63399 19.031 1.43975 17.5863C1.24998 16.1748 1.24999 14.3658 1.25 12.0574V11.9426C1.24999 9.63423 1.24998 7.82519 1.43975 6.41371C1.63399 4.96897 2.03933 3.82895 2.93414 2.93414C3.82895 2.03933 4.96897 1.63399 6.41371 1.43975C7.82519 1.24998 9.63423 1.24999 11.9426 1.25ZM6.61358 2.92637C5.33517 3.09825 4.56445 3.42514 3.9948 3.9948C3.42514 4.56445 3.09825 5.33517 2.92637 6.61358C2.75159 7.91356 2.75 9.62178 2.75 12C2.75 14.3782 2.75159 16.0864 2.92637 17.3864C3.09825 18.6648 3.42514 19.4355 3.9948 20.0052C4.56445 20.5749 5.33517 20.9018 6.61358 21.0736C7.91356 21.2484 9.62178 21.25 12 21.25C14.3782 21.25 16.0864 21.2484 17.3864 21.0736C18.6648 20.9018 19.4355 20.5749 20.0052 20.0052C20.5749 19.4355 20.9018 18.6648 21.0736 17.3864C21.2484 16.0864 21.25 14.3782 21.25 12C21.25 9.62178 21.2484 7.91356 21.0736 6.61358C20.9018 5.33517 20.5749 4.56445 20.0052 3.9948C19.4355 3.42514 18.6648 3.09825 17.3864 2.92637C16.0864 2.75159 14.3782 2.75 12 2.75C9.62178 2.75 7.91356 2.75159 6.61358 2.92637Z" fill="currentColor"/>
    </svg>
  `;
}

// reicon.dev/icons/code-square (outline) — code panel toggle.
function CodeIcon() {
  return html`
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M14.0184 7.36446C14.1256 6.96436 13.8882 6.55311 13.4881 6.4459C13.088 6.3387 12.6767 6.57614 12.5695 6.97623L9.98131 16.6355C9.8741 17.0356 10.1115 17.4468 10.5116 17.5541C10.9117 17.6613 11.323 17.4238 11.4302 17.0237L14.0184 7.36446Z" fill="currentColor"/>
      <path d="M16.0303 8.46967C15.7374 8.17678 15.2626 8.17678 14.9697 8.46967C14.6768 8.76256 14.6768 9.23744 14.9697 9.53033L15.1412 9.7019C15.8229 10.3836 16.2797 10.8426 16.5753 11.2301C16.8577 11.6002 16.9216 11.8157 16.9216 12C16.9216 12.1843 16.8577 12.3998 16.5753 12.7699C16.2797 13.1574 15.8229 13.6164 15.1412 14.2981L14.9697 14.4697C14.6768 14.7626 14.6768 15.2374 14.9697 15.5303C15.2626 15.8232 15.7374 15.8232 16.0303 15.5303L16.2387 15.322C16.874 14.6867 17.4038 14.1569 17.7678 13.6798C18.1521 13.1762 18.4216 12.6441 18.4216 12C18.4216 11.3559 18.1521 10.8238 17.7678 10.3202C17.4038 9.84307 16.874 9.31331 16.2387 8.67801L16.0303 8.46967Z" fill="currentColor"/>
      <path d="M7.96986 8.46967C8.26275 8.17678 8.73762 8.17678 9.03052 8.46967C9.32341 8.76256 9.32341 9.23744 9.03052 9.53033L8.85894 9.7019C8.17729 10.3836 7.72052 10.8426 7.42488 11.2301C7.14245 11.6002 7.07861 11.8157 7.07861 12C7.07861 12.1843 7.14245 12.3998 7.42488 12.7699C7.72052 13.1574 8.17729 13.6164 8.85894 14.2981L9.03052 14.4697C9.32341 14.7626 9.32341 15.2374 9.03052 15.5303C8.73762 15.8232 8.26275 15.8232 7.96986 15.5303L7.76151 15.322C7.12618 14.6867 6.59637 14.1569 6.23235 13.6798C5.84811 13.1762 5.57861 12.6441 5.57861 12C5.57861 11.3559 5.84811 10.8238 6.23235 10.3202C6.59637 9.84307 7.12617 9.31332 7.7615 8.67802L7.96986 8.46967Z" fill="currentColor"/>
      <path fill-rule="evenodd" clip-rule="evenodd" d="M11.9426 1.25C9.63423 1.24999 7.82519 1.24998 6.41371 1.43975C4.96897 1.63399 3.82895 2.03933 2.93414 2.93414C2.03933 3.82895 1.63399 4.96897 1.43975 6.41371C1.24998 7.82519 1.24999 9.63423 1.25 11.9426V12.0574C1.24999 14.3658 1.24998 16.1748 1.43975 17.5863C1.63399 19.031 2.03933 20.1711 2.93414 21.0659C3.82895 21.9607 4.96897 22.366 6.41371 22.5603C7.82519 22.75 9.63423 22.75 11.9426 22.75H12.0574C14.3658 22.75 16.1748 22.75 17.5863 22.5603C19.031 22.366 20.1711 21.9607 21.0659 21.0659C21.9607 20.1711 22.366 19.031 22.5603 17.5863C22.75 16.1748 22.75 14.3658 22.75 12.0574V11.9426C22.75 9.63423 22.75 7.82519 22.5603 6.41371C22.366 4.96897 21.9607 3.82895 21.0659 2.93414C20.1711 2.03933 19.031 1.63399 17.5863 1.43975C16.1748 1.24998 14.3658 1.24999 12.0574 1.25H11.9426ZM3.9948 3.9948C4.56445 3.42514 5.33517 3.09825 6.61358 2.92637C7.91356 2.75159 9.62178 2.75 12 2.75C14.3782 2.75 16.0864 2.75159 17.3864 2.92637C18.6648 3.09825 19.4355 3.42514 20.0052 3.9948C20.5749 4.56445 20.9018 5.33517 21.0736 6.61358C21.2484 7.91356 21.25 9.62178 21.25 12C21.25 14.3782 21.2484 16.0864 21.0736 17.3864C20.9018 18.6648 20.5749 19.4355 20.0052 20.0052C19.4355 20.5749 18.6648 20.9018 17.3864 21.0736C16.0864 21.2484 14.3782 21.25 12 21.25C9.62178 21.25 7.91356 21.2484 6.61358 21.0736C5.33517 20.9018 4.56445 20.5749 3.9948 20.0052C3.42514 19.4355 3.09825 18.6648 2.92637 17.3864C2.75159 16.0864 2.75 14.3782 2.75 12C2.75 9.62178 2.75159 7.91356 2.92637 6.61358C3.09825 5.33517 3.42514 4.56445 3.9948 3.9948Z" fill="currentColor"/>
    </svg>
  `;
}

// reicon.dev/icons/coffee (outline).
function CoffeeIcon() {
  return html`
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M17.79 10.47V17.79C17.79 20.12 15.9 22 13.58 22H6.21C3.89 22 2 20.11 2 17.79V10.47C2 8.14001 3.89 6.26001 6.21 6.26001H13.58C15.9 6.26001 17.79 8.15001 17.79 10.47Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M5.5 4V2.25" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M9.5 4V2.25" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M13.5 4V2.25" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M22 13.16C22 15.48 20.11 17.37 17.79 17.37V8.94995C20.11 8.94995 22 10.83 22 13.16Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M2 12H17.51" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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
              <button class="gts-tbtn" title="Rewind" disabled=${!entry} onClick=${() => entry && seek(entry, 0)}><${RewindIcon} /></button>
              <button
                class="gts-tbtn play"
                title=${playing ? 'Pause' : 'Play'}
                disabled=${!entry}
                onClick=${() => entry && (playing ? pause(entry) : play(entry))}
              >
                ${playing ? html`<${PauseIcon} />` : html`<${PlayIcon} />`}
              </button>
              <button
                class="gts-tbtn ${looping ? 'on' : ''}"
                title=${loops ? 'Already repeats infinitely' : looping ? 'Loop: on, replays on completion' : 'Loop: off'}
                disabled=${!entry || loops}
                onClick=${() => entry && toggleLoop(entry.id)}
              >
                <${RepeatIcon} />
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
            <${ExpandIcon} />
          </button>
          <span class="gts-vsep" aria-hidden="true"></span>
          <button class="gts-close" title="Close the mini player" onClick=${() => (miniOpen.value = false)}><${CloseIcon} /></button>
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
            <${ListIcon} /><span class="gts-abtn-text"> Properties</span>
          </button>
          <button
            class="gts-abtn ${codeOpen.value ? 'on' : ''}"
            title="Toggle the code panel"
            onClick=${() => (codeOpen.value = !codeOpen.value)}
          >
            <${CodeIcon} /><span class="gts-abtn-text"> Code</span>
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
            <${CoffeeIcon} />
            <span class="gts-coffee-text">Buy me a coffee</span>
          </a>
          <span class="gts-close-inline">
            <span class="gts-vsep" aria-hidden="true"></span>
            <button class="gts-close" title="Close" onClick=${() => (panelOpen.value = false)}><${CloseIcon} /></button>
          </span>
        </div>
        <button class="gts-close gts-close-corner" title="Close" onClick=${() => (panelOpen.value = false)}><${CloseIcon} /></button>
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
        <span class="gts-code-chevron">${collapsed ? html`<${ChevronRightIcon} />` : html`<${ChevronDownIcon} />`}</span>
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
        ${panelOpen.value ? html`<${CloseIcon} />` : html`<${Logo} />`}
      </button>
      ${panelOpen.value ? html`<${Panel} />` : null}
      ${miniOpen.value && !panelOpen.value ? html`<${MiniPlayer} />` : null}
    </div>
  `;
}
