// Hover-to-highlight: draws an outline over a detected animation's real
// target element(s) via getBoundingClientRect(). No iframe, no coordinate
// translation, the boxes live in the studio's own shadow root, positioned
// `fixed` directly in viewport coordinates.

let shadowRootRef = null;
let boxes = [];
let raf = null;

export function mountHighlight(shadowRoot) {
  shadowRootRef = shadowRoot;
}

function place(box, el) {
  const r = el.getBoundingClientRect();
  box.style.transform = `translate(${r.left}px, ${r.top}px)`;
  box.style.width = `${r.width}px`;
  box.style.height = `${r.height}px`;
  box.style.display = r.width || r.height ? 'block' : 'none';
}

function tick(targets) {
  boxes.forEach((box, i) => {
    const el = targets[i];
    if (el && el.isConnected) place(box, el);
  });
  raf = requestAnimationFrame(() => tick(targets));
}

export function showHighlight(targets) {
  clearHighlight();
  if (!shadowRootRef) return;
  const els = (targets || []).filter((t) => typeof Element !== 'undefined' && t instanceof Element && t.isConnected);
  if (!els.length) return;
  boxes = els.map(() => {
    const box = document.createElement('div');
    box.className = 'gts-highlight-box';
    shadowRootRef.appendChild(box);
    return box;
  });
  els.forEach((el, i) => place(boxes[i], el));
  raf = requestAnimationFrame(() => tick(els));
}

export function clearHighlight() {
  if (raf) cancelAnimationFrame(raf);
  raf = null;
  boxes.forEach((b) => b.remove());
  boxes = [];
}
