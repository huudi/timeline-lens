// CSSOM's rule.cssText is always a single compact line (e.g. `div { color:
// red; opacity: 1; }`) — browsers never pretty-print it, even for a
// multi-declaration rule or a @keyframes rule with several nested percentage
// blocks. describe-css.js and css-source.js hand that compact text straight
// to the Code panel's <pre>, so it needs reformatting first: one declaration
// (or nested rule) per line, each level indented two spaces further, the
// same shape as source hand-authored CSS.
//
// A real CSS parser is overkill for text the browser already validated and
// serialized consistently, so this just splits on the top-level `{`/`}`/`;`
// boundaries, recursing into nested blocks (needed for @keyframes's `0% {
// ... }` children). Best-effort like the rest of this file's neighbors: a
// `;` or `{` hiding inside a quoted value (e.g. `content: "a;b"`) would
// split wrong, but that's rare enough in animation-related CSS not to be
// worth a full tokenizer.
function formatBlock(text, depth) {
  const indent = '  '.repeat(depth);
  const lines = [];
  let i = 0;
  while (i < text.length) {
    while (i < text.length && /\s/.test(text[i])) i++;
    if (i >= text.length) break;
    let j = i;
    while (j < text.length && text[j] !== '{' && text[j] !== ';') j++;
    if (text[j] === '{') {
      const selector = text.slice(i, j).trim();
      let braceDepth = 1;
      let k = j + 1;
      while (k < text.length && braceDepth > 0) {
        if (text[k] === '{') braceDepth++;
        else if (text[k] === '}') braceDepth--;
        k++;
      }
      lines.push(`${indent}${selector} {`);
      lines.push(formatBlock(text.slice(j + 1, k - 1), depth + 1));
      lines.push(`${indent}}`);
      i = k;
    } else {
      const decl = text.slice(i, j).trim();
      if (decl) lines.push(`${indent}${decl};`);
      i = j + 1;
    }
  }
  return lines.join('\n');
}

export function formatCssText(cssText) {
  if (!cssText) return cssText;
  return formatBlock(cssText.trim(), 0);
}
