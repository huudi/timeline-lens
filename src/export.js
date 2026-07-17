// Exports the detected animation tree as JSON — for filing a bug report, or
// just keeping a record of what a page was running at some point in time.
// Read-only like everything else here: this walks the same node shape the
// UI already renders from, picking out only the plain-data fields (no DOM
// elements, no gsap/Animation instances, nothing circular) and reusing
// util.js's paramLines/targetLabel so the exported params match what the
// Properties panel already shows for each engine.

import { targetLabel } from './detect.js';
import { paramLines } from './ui/util.js';

function buildExportNode(node) {
  return {
    id: node.id,
    label: node.label,
    type: node.type,
    engine: node.engine,
    duration: node.duration,
    start: node.start || 0,
    repeat: node.repeat ?? 0,
    yoyo: !!node.yoyo,
    delay: node.delay || 0,
    reconstructed: !!node.isCompleted,
    targets: (node.targets || []).map(targetLabel),
    params: paramLines(node),
    children: (node.children || []).map(buildExportNode),
  };
}

export function buildExportSnapshot(entries) {
  return {
    exportedAt: new Date().toISOString(),
    url: typeof location !== 'undefined' ? location.href : null,
    animations: entries.map(buildExportNode),
  };
}

// Triggers a browser download of the current entries as a .json file. A
// plain anchor + object URL, no dependency needed for something this small.
export function downloadEntriesAsJson(entries) {
  const snapshot = buildExportSnapshot(entries);
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = snapshot.exportedAt.replace(/[:.]/g, '-');
  a.href = url;
  a.download = `timeline-lens-export-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
