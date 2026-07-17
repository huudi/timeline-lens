// Best-effort static scan of the page's own same-origin script sources, to
// recover the *actual* variable name and source text a detected animation
// was authored with. This is only possible in a dev context: the host
// project's own JS is fetchable, same-origin text, not a black box, and it
// gives the Code panel something better than a synthetic guess (see
// describe.js's jsSnippet, kept as a fallback for anything not found here).
//
// This is a lightweight scan, not a real parser: it finds `const/let/var x =
// gsap.timeline(...)`-shaped declarations (and bare, unassigned calls) via
// regex, then hand-balances parens/braces/brackets/strings to capture the
// full statement, including any immediately chained `.to()/.from()/...`
// calls. No @babel/parser or similar; this is inspection, not codegen.

let cache = null; // { byId: Map<string, Found>, bySelector: Map<string, Found> }
let loading = null;

// Matches relative import/export specifiers (`from './x.js'`, `import
// './x.js'`, dynamic `import('./x.js')`) so the crawl below can follow a
// project's own module graph, not just the entry `<script>` tags. Bare
// specifiers (`from 'gsap'`) are intentionally left alone; those resolve
// through Vite/import-maps, not as plain relative fetches.
const IMPORT_RE =
  /(?:import\s+(?:[\w$*{}\n\r\t, ]+\s+from\s+)?|export\s+(?:[\w$*{}\n\r\t, ]+\s+from\s+)?)["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;

const NON_MODULE_EXTS = new Set([
  'css', 'json', 'html', 'svg', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'ico',
  'woff', 'woff2', 'ttf', 'otf',
]);

function isLikelyModule(spec) {
  const ext = spec.split(/[?#]/)[0].split('.').pop().toLowerCase();
  return !NON_MODULE_EXTS.has(ext);
}

// Vite's dev server rewrites bare specifiers (`from "react"`) into absolute,
// same-origin paths under /node_modules/.vite/deps/ in the JS it actually
// serves, so a resolved specifier starting with '/' can point straight into
// a pre-bundled vendor chunk even though the source code never wrote a
// relative/absolute import itself. Those chunks are never "the host
// project's own JS" (see header comment above), so crawling into them is
// both wasted work and a source of false positives: e.g. React's dev build
// embeds the literal string `import('./MyComponent')` inside a warning
// message, which IMPORT_RE (a regex, not a real parser) reads as a real
// dynamic import and tries to fetch: a guaranteed 404 for a path nothing
// authored.
function isVendorPath(pathname) {
  return /\/node_modules\//.test(pathname);
}

// The studio's own source root: normally excluded already by isVendorPath
// above (a real consumer installs it under node_modules), but this repo's
// own dev/test apps link it in via npm workspaces instead, where Vite serves
// it from an absolute /@fs/... filesystem path OUTSIDE node_modules
// entirely, bypassing that check — so without this, the crawl (which
// exists to find the *host project's* own code, see the header comment)
// recurses straight into the studio's own source. That's not just wasted
// fetching: this very file's own comments contain literal strings that look
// like import specifiers (`'./x.js'`, `import('./MyComponent')`, used as
// prose examples a few lines up), which IMPORT_RE — a regex, not a real
// parser — cannot tell apart from real code, and happily "follows" as if
// they were, compounding into a much larger, slower, self-referential crawl.
const OWN_SRC_ROOT = new URL('.', import.meta.url).pathname;

function isOwnPackagePath(pathname) {
  return pathname.startsWith(OWN_SRC_ROOT);
}

// "Same origin as the page" (location.origin) is too narrow a check on its
// own: a dev proxy setup (e.g. DDEV fronting the app on :443 while Vite's
// own dev server listens on :5173, per vite.config.ts's `server.origin`)
// serves the entry `<script src>` itself from a different port, and
// therefore a different origin, than location.origin — even though it's
// still 100% the host project's own script, just fetched from Vite's dev
// origin instead of the page's. Without this, fetchSameOriginScripts below
// filters out every entry script in that setup and the crawl never starts.
// Treat any origin an entry `<script>` tag on the page actually uses as
// fair game too, not just location.origin.
export function allowedOrigins() {
  const origins = new Set([location.origin]);
  for (const el of document.scripts) {
    if (!el.src) continue;
    try {
      origins.add(new URL(el.src, location.href).origin);
    } catch {}
  }
  return origins;
}

// Same-origin scripts reachable from the page: the entry `<script>` tags
// themselves, plus everything they (transitively) import via relative
// specifiers, e.g. a nav bar's animation authored in its own module and
// pulled into main.js via `import './nav.js'` never appears as a `<script>`
// element itself, so it has to be discovered by following imports instead.
async function fetchSameOriginScripts() {
  const origins = allowedOrigins();
  const entryUrls = new Set();
  for (const el of document.scripts) {
    if (!el.src) continue;
    try {
      const u = new URL(el.src, location.href);
      if (origins.has(u.origin) && !isVendorPath(u.pathname) && !isOwnPackagePath(u.pathname)) entryUrls.add(el.src);
    } catch {}
  }

  const visited = new Set();
  const files = [];
  const queue = [...entryUrls];

  while (queue.length) {
    const url = queue.shift();
    if (visited.has(url)) continue;
    visited.add(url);

    let text = '';
    try {
      const res = await fetch(url);
      text = res.ok ? await res.text() : '';
    } catch {}
    files.push({ url, text });
    if (!text) continue;

    IMPORT_RE.lastIndex = 0;
    let m;
    while ((m = IMPORT_RE.exec(text))) {
      const spec = m[1] || m[2];
      if (!spec || !(spec.startsWith('.') || spec.startsWith('/')) || !isLikelyModule(spec)) continue;
      try {
        const resolved = new URL(spec, url);
        if (
          origins.has(resolved.origin) &&
          !isVendorPath(resolved.pathname) &&
          !isOwnPackagePath(resolved.pathname) &&
          !visited.has(resolved.href)
        ) {
          queue.push(resolved.href);
        }
      } catch {}
    }
  }

  return files;
}

// 1-based line number of `index` within `text` (files are handled
// individually now — see parseFile — so this is a plain local lookup, no
// cross-file offset math needed).
function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

// The captured text is a verbatim slice of the file starting exactly at the
// matched statement (no leading whitespace to trim), but continuation lines
// still carry the file's original indentation; left as-is, they read as
// misaligned relative to the un-indented first line. Strip the common
// leading whitespace off every line after the first so the snippet reads as
// if it were indented from column 0, and drop trailing whitespace.
function dedent(raw) {
  const text = raw.replace(/\s+$/, '');
  const lines = text.split('\n');
  if (lines.length <= 1) return text;
  const rest = lines.slice(1).filter((l) => l.trim());
  const minIndent = rest.length ? Math.min(...rest.map((l) => /^[ \t]*/.exec(l)[0].length)) : 0;
  return [lines[0], ...lines.slice(1).map((l) => l.slice(minIndent))].join('\n');
}

// Identifiers a reference to which shouldn't pull unrelated top-level code
// into a component snippet: JS syntax keywords plus common host/library
// globals (see extractIdentifiers below).
const IDENT_STOPLIST = new Set([
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'do',
  'switch', 'case', 'break', 'continue', 'new', 'delete', 'typeof', 'instanceof',
  'in', 'of', 'this', 'null', 'undefined', 'true', 'false', 'class', 'extends',
  'super', 'try', 'catch', 'finally', 'throw', 'yield', 'async', 'await', 'static',
  'get', 'set', 'import', 'export', 'default', 'from', 'as', 'void',
  'window', 'document', 'console', 'Math', 'JSON', 'Array', 'Object', 'Number',
  'String', 'Boolean', 'Symbol', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Promise',
  'RegExp', 'Date', 'Error', 'TypeError', 'RangeError', 'Element', 'HTMLElement',
  'Node', 'Event', 'CustomEvent', 'fetch', 'setTimeout', 'clearTimeout', 'setInterval',
  'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame', 'localStorage',
  'sessionStorage', 'navigator', 'location', 'history', 'performance',
  'gsap', 'ScrollTrigger', 'ScrollSmoother', 'Draggable', 'Observer', 'SplitText',
  'CustomEase', 'MotionPathPlugin', 'TextPlugin', 'Flip',
]);

// Free identifiers referenced within `text`: plain `\w+` matches, minus
// property-access names (`el.classList` -> `classList` isn't a reference to
// a top-level `classList`, so anything immediately preceded by `.` is
// skipped), minus object-literal keys (`{ id: 'x' }` -> `id` isn't a
// reference either, so anything immediately followed by `:` is skipped —
// this also correctly keeps shorthand properties like `{ slides }`, which
// have no colon), minus the stoplist above.
function extractIdentifiers(text) {
  const ids = new Set();
  const re = /\b[A-Za-z_$][\w$]*\b/g;
  let m;
  while ((m = re.exec(text))) {
    const id = m[0];
    if (IDENT_STOPLIST.has(id)) continue;
    let before = m.index - 1;
    while (before >= 0 && /\s/.test(text[before])) before--;
    if (text[before] === '.') continue;
    let after = m.index + id.length;
    while (after < text.length && /\s/.test(text[after])) after++;
    if (text[after] === ':' && text[after + 1] !== ':') continue;
    ids.add(id);
  }
  return ids;
}

// Splits `text` into top-level statements by tracking paren/brace/bracket
// depth (skipping over strings/template literals and comments so their
// contents can't desync it): a statement ends either at a `;` seen while
// depth is 0, or right after a bracket closes depth back to 0 (covering
// unterminated block statements like `function f() {...}` with no trailing
// `;`). This is the unit expandToComponent below reasons about — coarse
// (not a real parser, same tradeoff as the rest of this file) but good
// enough to tell "a whole function/const/statement" apart from "a random
// mid-expression slice".
function topLevelStatements(text) {
  const spans = [];
  let i = 0;
  let start = 0;
  let depth = 0;
  let inStr = null;
  while (i < text.length) {
    const c = text[i];
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
    if (c === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && text[i + 1] === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    if (c === '(' || c === '{' || c === '[') {
      depth++;
      i++;
      continue;
    }
    if (c === ')' || c === '}' || c === ']') {
      depth = Math.max(0, depth - 1);
      i++;
      // Only a brace closing back to depth 0 ends a statement here (a block:
      // function/if/for/while/class body, or a bare `{...}`) — a `(...)` or
      // `[...]` closing to depth 0 is just a call/param-list/array literal
      // finishing mid-statement (e.g. `function f(a, b)` before its body, or
      // `arr[i]` before a trailing `.method()`), and must NOT end the
      // statement early; those are terminated by the `;` branch below once
      // the whole expression statement is actually done.
      if (depth === 0 && c === '}') {
        let j = i;
        while (j < text.length && /[ \t]/.test(text[j])) j++;
        if (text[j] === ';') j++;
        spans.push([start, j]);
        start = j;
      }
      continue;
    }
    if (c === ';' && depth === 0) {
      i++;
      spans.push([start, i]);
      start = i;
      continue;
    }
    i++;
  }
  if (text.slice(start).trim()) spans.push([start, text.length]);
  return spans.filter(([s, e]) => text.slice(s, e).trim());
}

const DECL_NAME_RE = /^(?:const|let|var)\s+([A-Za-z_$][\w$]*)/;
const FUNC_NAME_RE = /^(?:async\s+)?function\s*\*?\s+([A-Za-z_$][\w$]*)/;

// Leading whitespace AND comments (// and /* */): topLevelStatements
// attaches a statement's preceding comment(s) to the start of its own span
// (there's no separate "trivia" token to hang them off instead), which is
// exactly right for display — a doc comment stays glued to what it
// documents — but means a raw `^\s*` anchor alone fails to reach the actual
// `const`/`function` keyword whenever a statement is preceded by one, e.g. a
// `// 15. Fade-in slide carousel...` block comment sitting right before
// `const slides = ...` (see apps/test-site/src/main.js): declaredNameOf must
// see past that comment or it silently returns null for an otherwise
// perfectly good declaration, dropping it from byName entirely.
function stripLeadingTrivia(text) {
  let i = 0;
  while (i < text.length) {
    if (/\s/.test(text[i])) {
      i++;
      continue;
    }
    if (text[i] === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      continue;
    }
    if (text[i] === '/' && text[i + 1] === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    break;
  }
  return text.slice(i);
}

// The single name a top-level statement introduces (a `const/let/var`'s own
// name, or a `function name(...)`'s own name), or null for statements that
// don't declare anything (event-listener wiring, a bare call, ...).
function declaredNameOf(stmtText) {
  const trimmed = stripLeadingTrivia(stmtText);
  return (DECL_NAME_RE.exec(trimmed) || FUNC_NAME_RE.exec(trimmed) || [])[1] || null;
}

// Blanks out comment and string-literal contents (replaced with spaces,
// preserving length/newlines so nothing downstream needs re-indexing),
// leaving only actual code for identifier matching. Without this, prose in a
// doc comment mentioning a declared name in passing — e.g. "fades/slides the
// header in" near an unrelated `intro` timeline, sitting right next to this
// file's real `slides` carousel array — reads as a genuine reference and
// drags unrelated code into the component. `\b` word-boundaries alone don't
// help: '/' and other punctuation are non-word characters too, so "slides"
// inside "fades/slides" still matches as a whole word.
function stripCommentsAndStrings(text) {
  let out = '';
  let i = 0;
  let inStr = null;
  while (i < text.length) {
    const c = text[i];
    if (inStr) {
      if (c === '\\') {
        out += '  ';
        i += 2;
        continue;
      }
      if (c === inStr) inStr = null;
      out += c === '\n' ? '\n' : ' ';
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      inStr = c;
      out += ' ';
      i++;
      continue;
    }
    if (c === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') {
        out += ' ';
        i++;
      }
      continue;
    }
    if (c === '/' && text[i + 1] === '*') {
      out += '  ';
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) {
        out += text[i] === '\n' ? '\n' : ' ';
        i++;
      }
      if (i < text.length) {
        out += '  ';
        i += 2;
      }
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

function buildByNameMap(text, stmts) {
  const byName = new Map();
  stmts.forEach(([s, e], i) => {
    const name = declaredNameOf(text.slice(s, e));
    if (name && !byName.has(name)) byName.set(name, i);
  });
  return byName;
}

// Expands a single matched span into "the component it belongs to": its own
// enclosing top-level statement (e.g. a bare `gsap.fromTo(...)` call sitting
// inside `function fadeInSlideText(slide) {...}` expands to that whole
// function, not just the call), plus every other top-level statement
// transitively connected to it by a shared identifier — followed in both
// directions: forward (a statement's own free variables, e.g. `goToSlide`
// referencing `slides`/`activeSlideIndex`/`fadeInSlideText` pulls in their
// declarations) and backward (once something is included, any other
// statement that references *it* back, e.g. `slidePrevBtn.addEventListener`
// referencing `goToSlide`, or the page's initial `fadeInSlideText(...)`
// call, is pulled in too). This mirrors how a reader would trace "what else
// does this animation depend on, and what else depends on it" by hand, and
// is what turns a single matched tween into the carousel's slides/dots/
// buttons/state/handlers/wiring as a whole.
// `codeTexts[i]` is the comment/string-stripped text of `stmts[i]`,
// precomputed once per file (see parseFile) — all identifier matching below
// runs against these, never against the raw statement text, so prose in
// comments and string contents can't masquerade as real references. The
// final displayed snippet still slices from the original `text`, unstripped.
function expandToComponent(text, stmts, codeTexts, byName, matchStart) {
  const seedIdx = stmts.findIndex(([s, e]) => matchStart >= s && matchStart < e);
  if (seedIdx === -1) return null;

  const MAX_STMTS = 40;
  const included = new Set([seedIdx]);
  const queue = [seedIdx];

  while (queue.length && included.size < MAX_STMTS) {
    const i = queue.shift();

    for (const name of extractIdentifiers(codeTexts[i])) {
      const declIdx = byName.get(name);
      if (declIdx != null && !included.has(declIdx)) {
        included.add(declIdx);
        queue.push(declIdx);
      }
    }

    const declaredHere = declaredNameOf(codeTexts[i]);
    if (declaredHere) {
      const refRe = new RegExp(`\\b${declaredHere}\\b`);
      for (let j = 0; j < stmts.length && included.size < MAX_STMTS; j++) {
        if (included.has(j)) continue;
        if (refRe.test(codeTexts[j])) {
          included.add(j);
          queue.push(j);
        }
      }
    }
  }

  const ordered = [...included].sort((a, b) => a - b);
  const combined = ordered.map((i) => dedent(text.slice(stmts[i][0], stmts[i][1]).replace(/^\s+/, ''))).join('\n\n');
  return { text: combined, seedStart: stmts[seedIdx][0] };
}

// Finds the index just past the bracket that opens at `openIdx`, respecting
// nested parens/braces/brackets and string/template literals.
function matchBalanced(src, openIdx) {
  let i = openIdx;
  let depth = 0;
  let inStr = null;
  for (; i < src.length; i++) {
    const c = src[i];
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

// From `idx`, if what follows (skipping whitespace) is `.method(...)`,
// balances that call and keeps consuming further immediately-chained
// `.method(...)` calls. Returns `idx` unchanged if there's no chain at all.
function followChains(src, idx) {
  let j = idx;
  while (true) {
    let k = j;
    while (k < src.length && /\s/.test(src[k])) k++;
    if (src[k] !== '.') break;
    let m = k + 1;
    while (m < src.length && /[\w$]/.test(src[m])) m++;
    let p = m;
    while (p < src.length && /\s/.test(src[p])) p++;
    if (src[p] !== '(') break;
    j = matchBalanced(src, p);
  }
  return j;
}

function matchCall(src, openIdx) {
  return followChains(src, matchBalanced(src, openIdx));
}

// A common pattern this codebase (and plenty of real ones) uses is building
// a timeline across two statements: `const tl = gsap.timeline(...);` then a
// separate `tl.addLabel(...).from(...)...;` chained off the bare identifier.
// If the statement right after `afterIdx` is exactly that shape, capture it
// too so the source shown for `tl` includes the whole authored animation,
// not just the constructor call.
function trailingChainFor(src, afterIdx, ident) {
  let i = afterIdx;
  while (i < src.length && /[\s;]/.test(src[i])) i++;
  if (!src.startsWith(ident, i) || /[\w$]/.test(src[i + ident.length] || '')) return null;
  const start = i;
  const afterIdent = i + ident.length;
  const end = followChains(src, afterIdent);
  if (end === afterIdent) return null; // bare reference, not a chained statement
  let e = end;
  while (e < src.length && /\s/.test(src[e])) e++;
  if (src[e] === ';') e++;
  return [start, e];
}

function consumeStatementEnd(src, idx) {
  let e = idx;
  while (e < src.length && /\s/.test(src[e])) e++;
  if (src[e] === ';') e++;
  return e;
}

const DECL_RE = /\b(const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*gsap\s*\.\s*(timeline|to|from|fromTo)\s*\(/g;
// Reassignment of an already-declared variable (`x = gsap.timeline(...)`,
// no const/let/var), e.g. a variable declared once and (re)assigned later
// inside an event handler.
const ASSIGN_RE = /\b([A-Za-z_$][\w$]*)\s*=\s*gsap\s*\.\s*(timeline|to|from|fromTo)\s*\(/g;
const BARE_RE = /gsap\s*\.\s*(timeline|to|from|fromTo)\s*\(/g;

// The WAAPI/Motion mirror of the three above: any `<expr>.animate(` call
// (`el.animate(...)`, `ref.current.animate(...)`, Motion's imported
// `animate(el, ...)` free-function form), not just a gsap method. There's
// no bare-selector-string first argument to key off the way there is for
// gsap.to('.selector', ...), so unlike the gsap patterns, findAnimateSource
// below only ever matches by an authored `id:` (see idOf), which a
// WAAPI/Motion call surfaces as a real, standard options property, already
// present as node.label for a waapi/motion node (see detect-css.js).
//
// Deliberately just the anchor, not "<expr>.animate(" in one pattern: a
// receiver can be an arbitrarily long chain (`a.b.c.d.animate(`), and a
// regex that tries to greedily capture that chain itself
// (`[\w$.]*\.animate`) is vulnerable to catastrophic backtracking on any
// large text with long word/dot runs that DON'T end in ".animate(" —
// confirmed empirically: over 17 seconds on Vite's dev client script alone,
// which contains zero actual matches. receiverStart() below finds the same
// chain with a plain bounded backward scan instead, no ambiguity to
// backtrack over.
const ANIMATE_METHOD_RE = /\.animate\s*\(/g;
// Motion's free-function form (`animate(el, {...})`), the negative
// lookbehind keeps this from double-matching the `.animate(` method form
// ANIMATE_METHOD_RE already covers (a word boundary sits at "." too).
const ANIMATE_FN_RE = /(?<!\.)\banimate\s*\(/g;

// Walks backward from a `.animate(`'s dot to the start of its receiver
// expression (the longest run of identifier/dot characters immediately
// before it), e.g. finds `ref.current` given the index of the dot in
// `ref.current.animate(`. Bounded by the receiver's own (always short)
// length, not the surrounding file, so this is always fast.
function receiverStart(src, dotIdx) {
  let i = dotIdx;
  while (i > 0 && /[\w$.]/.test(src[i - 1])) i--;
  return i;
}

// A `const/let/var name = ` immediately before `start` (the receiver's own
// start, or a bare `animate(` call's own start), checked only in a small,
// fixed-size window right before it — bounded the same way, never a scan
// over the rest of the file. The `d` flag gives back each group's own
// [start, end] indices (.indices), so the declaration's own start position
// can be read directly rather than re-deriving it by hand from match text
// (fragile: the leading `(?:^|[;{}\n])\s*` is variable-length, and its
// delimiter character, when present, is non-whitespace itself, so a plain
// "first non-whitespace char" search would stop on it instead of skipping
// past it to "const"/"let"/"var").
const TRAILING_DECL_RE = /(?:^|[;{}\n])\s*(const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*$/d;

// Returns { varName, start } (absolute index in `src`) if a declaration
// immediately precedes `start`, else null.
function precedingDecl(src, start) {
  const from = Math.max(0, start - 80);
  const m = TRAILING_DECL_RE.exec(src.slice(from, start));
  if (!m) return null;
  return { varName: m[2], start: from + m.indices[1][0] };
}

function idOf(text) {
  const m = /\bid\s*:\s*["'`]([^"'`]+)["'`]/.exec(text);
  return m ? m[1] : null;
}

function selectorOf(text) {
  const m = /\(\s*["'`]([^"'`]+)["'`]/.exec(text);
  return m ? m[1] : null;
}

// Parses a single file's text (each file is handled independently now, not
// concatenated — see the header comment for why: expandToComponent needs a
// real top-level statement split, which only means something within one
// file's own module scope). Every match's captured text is expanded to its
// full component via expandToComponent before being recorded, so the JS
// panel shows not just the matched animation call but everything it's wired
// to (sibling element lookups, helper functions, event-listener bindings,
// the initial invocation, ...).
function parseFile(text, url) {
  const found = [];
  const spans = [];
  const stmts = topLevelStatements(text);
  const byName = buildByNameMap(text, stmts);
  const codeTexts = stmts.map(([s, e]) => stripCommentsAndStrings(text.slice(s, e)));

  // `keyText` is always the narrow, single-statement match — the same text
  // this function returned before component expansion existed — kept
  // separately so idOf/selectorOf (in ensureLoaded below) key off the exact
  // animation call itself, not whichever string literal happens to appear
  // first in the larger expanded component (e.g. a sibling
  // `querySelectorAll('.slide-carousel .slide')`, which would otherwise
  // shadow the real `.slide-text` selector this match is actually for).
  // `text` is the expanded component, used only for display.
  function record(start, end, varName, method) {
    const keyText = dedent(text.slice(start, end));
    const expansion = expandToComponent(text, stmts, codeTexts, byName, start);
    const outText = expansion ? expansion.text : keyText;
    const locIndex = expansion ? expansion.seedStart : start;
    found.push({ varName, method, text: outText, keyText, url, line: lineOf(text, locIndex) });
  }

  DECL_RE.lastIndex = 0;
  let m;
  while ((m = DECL_RE.exec(text))) {
    const start = m.index;
    const openIdx = start + m[0].length - 1;
    const declEnd = consumeStatementEnd(text, matchCall(text, openIdx));
    const chain = trailingChainFor(text, declEnd, m[2]);
    const end = chain ? chain[1] : declEnd;
    spans.push([start, end]);
    record(start, end, m[2], m[3]);
  }

  ASSIGN_RE.lastIndex = 0;
  while ((m = ASSIGN_RE.exec(text))) {
    const start = m.index;
    if (spans.some(([s, e]) => start >= s && start < e)) continue; // already captured as a declaration
    const openIdx = start + m[0].length - 1;
    const end = matchCall(text, openIdx);
    spans.push([start, end]);
    record(start, end, m[1], m[2]);
  }

  BARE_RE.lastIndex = 0;
  while ((m = BARE_RE.exec(text))) {
    const start = m.index;
    if (spans.some(([s, e]) => start >= s && start < e)) continue; // already part of a captured statement
    const openIdx = start + m[0].length - 1;
    const end = matchCall(text, openIdx);
    record(start, end, null, m[1]);
  }

  ANIMATE_METHOD_RE.lastIndex = 0;
  while ((m = ANIMATE_METHOD_RE.exec(text))) {
    const dotIdx = m.index;
    const receiver = receiverStart(text, dotIdx);
    const decl = precedingDecl(text, receiver);
    const start = decl ? decl.start : receiver;
    if (spans.some(([s, e]) => start >= s && start < e)) continue;
    const openIdx = dotIdx + m[0].length - 1;
    const end = decl ? consumeStatementEnd(text, matchCall(text, openIdx)) : matchCall(text, openIdx);
    spans.push([start, end]);
    record(start, end, decl?.varName ?? null, 'animate');
  }

  ANIMATE_FN_RE.lastIndex = 0;
  while ((m = ANIMATE_FN_RE.exec(text))) {
    const callStart = m.index;
    const decl = precedingDecl(text, callStart);
    const start = decl ? decl.start : callStart;
    if (spans.some(([s, e]) => start >= s && start < e)) continue;
    const openIdx = callStart + m[0].length - 1;
    const end = decl ? consumeStatementEnd(text, matchCall(text, openIdx)) : matchCall(text, openIdx);
    record(start, end, decl?.varName ?? null, 'animate');
  }

  return found;
}

async function ensureLoaded() {
  if (cache) return cache;
  if (!loading) {
    loading = fetchSameOriginScripts().then((files) => {
      const found = [];
      for (const f of files) {
        if (f.text) found.push(...parseFile(f.text, f.url));
      }
      const byId = new Map();
      const bySelector = new Map();
      for (const f of found) {
        const id = idOf(f.keyText);
        if (id && !byId.has(id)) byId.set(id, f);
        const sel = selectorOf(f.keyText);
        if (sel && !bySelector.has(sel)) bySelector.set(sel, f);
      }
      cache = { byId, bySelector };
      return cache;
    });
  }
  return loading;
}

function selectorGuess(node) {
  const el = (node.targets || []).find((t) => typeof Element !== 'undefined' && t instanceof Element);
  if (!el) return null;
  if (el.id) return `#${el.id}`;
  if (el.classList.length) return `.${el.classList[0]}`;
  return el.tagName.toLowerCase();
}

// Best-effort lookup of a detected node's real authored source; matches by
// `vars.id` first (exact), falling back to its first target's selector.
// Resolves to `null` if nothing in the page's own same-origin scripts
// matches (e.g. it's minified, bundled from elsewhere, or just not found).
export async function findSource(node) {
  const { byId, bySelector } = await ensureLoaded();
  const id = node.vars?.id;
  if (id != null && byId.has(String(id))) return byId.get(String(id));
  const sel = node.type === 'tween' ? selectorGuess(node) : null;
  if (sel && bySelector.has(sel)) return bySelector.get(sel);
  return null;
}

// The WAAPI/Motion mirror of findSource above: a waapi/motion leaf has no
// `vars.id` (that's a gsap-specific vars shape), but detect-css.js already
// reads an authored `.animate()` options `id` into node.label when present
// (falling back to a target-derived label otherwise, which simply won't be
// in byId, so this naturally no-ops for unauthored-id leaves the same way
// findSource no-ops for an unmatched selector). Prefer a stack-trace
// call-site over this when one was captured live (see motion-ref.js),
// that's an exact location, not a regex guess.
export async function findAnimateSource(node) {
  const { byId } = await ensureLoaded();
  return byId.get(String(node.label)) || null;
}

// ---- click-trigger detection -------------------------------------------------
//
// findSource/findAnimateSource's `text` is already the expanded component
// (see expandToComponent above), which pulls in any addEventListener wiring
// connected to the animation's own call or the helper function that wraps
// it — e.g. a carousel's prev/next buttons and nav dots calling the function
// that builds the tween. This is a plain text scan (same tradeoff as the
// rest of this file, not a real parser) for `<el>.addEventListener('click',
// ...)`, resolved back to a readable selector via that element's own
// declaration (getElementById/querySelector(All)) found earlier in the same
// text, including the common `list.forEach((item) =>
// item.addEventListener('click', ...))` shape used to wire up a whole
// NodeList/array at once (e.g. nav dots).

const ID_DECL_RE = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*document\s*\.\s*getElementById\(\s*["'`]([^"'`]+)["'`]\s*\)/g;
const QUERY_DECL_RE =
  /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:Array\.from\(\s*)?document\s*\.\s*querySelectorAll?\(\s*["'`]([^"'`]+)["'`]\s*\)/g;
const CLICK_LISTENER_RE = /\b([A-Za-z_$][\w$]*)\s*\.\s*addEventListener\(\s*["'`]click["'`]/g;
const FOREACH_RE = /\b([A-Za-z_$][\w$]*)\s*\.\s*forEach\(\s*\(?\s*([A-Za-z_$][\w$]*)/g;

// varName -> readable selector, from its own `document.getElementById(...)`
// or `document.querySelector(All)(...)` declaration earlier in the text.
// getElementById wins on a name collision (checked first, `!has` guards the
// querySelector pass) since an id-derived `#foo` is a tighter identifier
// than whatever selector a querySelector call happened to use.
function declaredSelectors(text) {
  const map = new Map();
  let m;
  ID_DECL_RE.lastIndex = 0;
  while ((m = ID_DECL_RE.exec(text))) map.set(m[1], `#${m[2]}`);
  QUERY_DECL_RE.lastIndex = 0;
  while ((m = QUERY_DECL_RE.exec(text))) if (!map.has(m[1])) map.set(m[1], m[2]);
  return map;
}

// loopVar -> outerVar, from `outer.forEach((loopVar) => ...)` / `outer.forEach(loopVar => ...)`.
function forEachLoopVars(text) {
  const map = new Map();
  let m;
  FOREACH_RE.lastIndex = 0;
  while ((m = FOREACH_RE.exec(text))) map.set(m[2], m[1]);
  return map;
}

// Readable selectors (e.g. `#slide-next`, `.slide-dot (each)`) for every
// element wired up with a click listener in `text`, deduped. A listener
// bound inside a `.forEach()` callback is resolved back to the collection's
// own selector, suffixed `(each)` since it's every item in that collection,
// not one specific element.
export function clickTriggerSelectors(text) {
  if (!text) return [];
  const selectors = declaredSelectors(text);
  const loopVars = forEachLoopVars(text);
  const found = new Set();
  let m;
  CLICK_LISTENER_RE.lastIndex = 0;
  while ((m = CLICK_LISTENER_RE.exec(text))) {
    let name = m[1];
    let each = false;
    if (!selectors.has(name) && loopVars.has(name)) {
      name = loopVars.get(name);
      each = true;
    }
    const sel = selectors.get(name);
    if (sel) found.add(each ? `${sel} (each)` : sel);
  }
  return [...found];
}

// Click-triggered elements for a detected node, resolved through whichever
// of findSource/findAnimateSource applies to its engine (see resolveJs in
// CodePanel.js for the same dispatch). Empty for anything not authored in a
// same-origin script findSource/findAnimateSource could locate at all.
export async function findClickTriggers(node) {
  const found = node.engine === 'waapi' || node.engine === 'motion' ? await findAnimateSource(node) : await findSource(node);
  return found ? clickTriggerSelectors(found.text) : [];
}
