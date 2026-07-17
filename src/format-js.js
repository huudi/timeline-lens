// Same job as format-css.js, but for the JS side: text captured verbatim
// from the page's own source (source.js) reads exactly as the developer
// wrote it — which, unlike CSSOM's always-compact cssText, is *usually*
// already readable, but nothing guarantees a chained gsap/WAAPI call was
// authored one link per line. A fluent chain written on a single physical
// line (`gsap.timeline({...}).fromTo(...).to(...).to(...)`) is valid,
// common, and unreadable once wrapped in a fixed-width <pre>. This reformats
// such a statement into one `.method(...)` call per line, the same shape
// describe.js's own reconstructed fallback already produces by hand.
//
// Not a real parser, same caveat as format-css.js: a plain bracket/string-
// aware scan, good enough for the narrow shape source.js actually captures
// (a `gsap.*`/`.animate(` call statement, its fluent chain, and at most one
// trailing chained statement off the same variable) — not general-purpose JS
// reformatting.

// Finds the index just past the bracket that opens at `openIdx`, respecting
// nested parens/braces/brackets and string/template literals — same
// primitive source.js's own parser uses, duplicated locally rather than
// imported since neither file wants a dependency on the other's larger scan.
function matchBalanced(text, openIdx) {
  let i = openIdx;
  let depth = 0;
  let inStr = null;
  for (; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (c === '\\') {
        i++;
        continue;
      }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      inStr = c;
      continue;
    }
    if (c === '(' || c === '{' || c === '[') depth++;
    else if (c === ')' || c === '}' || c === ']') {
      depth--;
      if (depth === 0) {
        i++;
        break;
      }
    }
  }
  return i;
}

// Splits on top-level `;` (depth 0, outside strings) so the at-most-two
// statements source.js can capture (a declaration/call plus one trailing
// chained statement, see its trailingChainFor) are formatted independently.
function splitStatements(text) {
  const stmts = [];
  let depth = 0;
  let inStr = null;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (c === '\\') {
        i++;
        continue;
      }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      inStr = c;
    } else if (c === '(' || c === '{' || c === '[') {
      depth++;
    } else if (c === ')' || c === '}' || c === ']') {
      depth--;
    } else if (c === ';' && depth === 0) {
      stmts.push(text.slice(start, i + 1));
      start = i + 1;
    }
  }
  const rest = text.slice(start).trim();
  if (rest) stmts.push(rest);
  return stmts.map((s) => s.trim()).filter(Boolean);
}

// Splits one statement (its trailing `;`, if any, already stripped) into its
// head — the receiver plus first call, e.g. `const tl = gsap.timeline({...})`
// or `tl.addLabel(...)` — and each subsequent top-level `.method(...)` link
// chained off it. Returns null when there's no call to split on at all.
function splitChain(body) {
  let i = 0;
  let inStr = null;
  while (i < body.length) {
    const c = body[i];
    if (inStr) {
      if (c === '\\') {
        i += 2;
        continue;
      }
      if (c === inStr) inStr = null;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      inStr = c;
      i++;
      continue;
    }
    if (c === '(') break;
    i++;
  }
  if (i >= body.length) return null;

  const headEnd = matchBalanced(body, i);
  const segments = [body.slice(0, headEnd)];
  let j = headEnd;
  while (true) {
    let k = j;
    while (k < body.length && /\s/.test(body[k])) k++;
    if (body[k] !== '.') break;
    let m = k + 1;
    while (m < body.length && /[\w$]/.test(body[m])) m++;
    let p = m;
    while (p < body.length && /\s/.test(body[p])) p++;
    if (body[p] !== '(') break; // a plain property access, not a call — leave the rest attached below
    const end = matchBalanced(body, p);
    segments.push(body.slice(k, end));
    j = end;
  }
  const leftover = body.slice(j).trim();
  if (leftover) segments[segments.length - 1] += ` ${leftover}`;
  return segments;
}

function formatStatement(stmt) {
  const hasSemi = stmt.endsWith(';');
  const body = (hasSemi ? stmt.slice(0, -1) : stmt).trim();
  const segments = splitChain(body);
  if (!segments || segments.length <= 1) return stmt; // no chain to break up, leave as authored
  const lines = [segments[0], ...segments.slice(1).map((seg) => `  ${seg}`)];
  return lines.join('\n') + (hasSemi ? ';' : '');
}

export function formatJsText(text) {
  if (!text) return text;
  return splitStatements(text.trim())
    .map(formatStatement)
    .join('\n');
}
