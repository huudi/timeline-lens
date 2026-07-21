# Timeline Lens

Your animations already exist: GSAP tweens, CSS keyframes, transitions, WAAPI calls. Timeline Lens just makes them visible, laid out as scrubbable tracks. It's a read-only, in-browser visual debugger, not an authoring tool: `console.log()` tells you a tween exists, Timeline Lens shows you where it starts, how long it runs, what it targets and how it eases, across GSAP, CSS and WAAPI alike, while the page keeps doing its thing.

Visit [timelinelens.com](https://timelinelens.com) to test the package on a live site and for more information.

Not affiliated with or built by GreenSock/GSAP.

## Features

Four things, done properly:

- **Detect** - walks `gsap.globalTimeline` and polls `document.getAnimations()` to catch every GSAP tween/timeline (including ScrollTrigger and `matchMedia()` setups), CSS `@keyframes` animation, CSS transition, and `element.animate()` call running on the page, including scroll-driven `view()` timelines and ones that already finished and got pruned.
- **Scrub** - play, pause, reverse, change speed, or drag the playhead across real GSAP and native WAAPI instances alike, in a track view (nested timeline children indented) or a flat, searchable/filterable list tagged with an engine chip (GSAP / CSS / WAAPI). Nothing here is faked: you're driving the actual animations.
- **Inspect** - a properties panel shows each animation's duration, repeat/yoyo/delay/fill/easing, targets, labels, and (for GSAP) detected plugins and ScrollTrigger/matchMedia config; plus a Code panel with a best-effort reconstruction of the call that created it. For GSAP, a static scan recovers the real authoring statement from your own same-origin scripts where possible, falling back to a synthesized snippet. For CSS, the authored `@keyframes` rule is recovered straight from your stylesheets. See [Where it looks for your code](#where-it-looks-for-your-code) for how the source scan works. Each section's snippet has a **Copy** button.
- **Highlight** - hover any track and its real DOM target lights up on the page, so you always know exactly what's moving, whatever engine is driving it.

Plus:

- **Export** - downloads the currently detected animation tree as a JSON file (label, engine, duration, targets, params, no DOM/live-instance references), for filing a bug report or just keeping a record.
- **Keyboard shortcuts** - `Space` plays/pauses the selected animation, `Esc` closes the panel/mini player, whichever is open. Scoped to while the studio itself is open, and ignored while typing in any input (the panel's own search box included), so they never hijack your page's own keystrokes.

## Core concepts

- **Nothing is authored here.** There's no canvas, no code generation, no export panel. If you didn't write the animation in your own code, it won't appear, and you can't create one from the panel either.
- **Two detection engines feed one panel.** On mount, and continuously afterward, it walks `gsap.globalTimeline.getChildren(true, true, true)`, recursing into nested timelines, and separately polls `document.getAnimations()` for CSS animations, CSS transitions, and `element.animate()` calls. Every track you see is a live instance from one of those two sources, not a copy. Scrubbing it calls `.seek()`/`.progress()` (gsap) or sets `.currentTime` (Web Animations API) on the real animation.
- **`gsap` is not a dependency of this package.** If your project uses gsap and has it installed, the studio resolves it dynamically and detects it alongside CSS/WAAPI animations, so it still runs fine on CSS and WAAPI alone when GSAP isn't installed. For GSAP detection to work at all, the package and your page have to share the exact same `gsap` module instance, which is why it's resolved live rather than bundled (see [GSAP support](#gsap-support)).
- **Completed animations are reconstructed, not real.** GSAP prunes finished, non-repeating tweens from `globalTimeline`, and the Web Animations API drops finished, non-`fill:forwards` animations from `document.getAnimations()` the same way. The studio snapshots each animation's data the moment it's first seen, so you can still scrub something that already finished, but scrubbing it plays a labeled **reconstruction** built from that snapshot, since the original instance no longer exists.
- **`gsap.matchMedia()` needs no special handling.** Responsive animations set up with `matchMedia()` are already real `gsap.timeline()`/tween instances that GSAP itself creates and reverts as breakpoints are crossed, and `@media`-scoped CSS animations are applied and removed by the browser itself the same way. The studio just re-runs its detection walk on resize, so the panel always reflects whichever breakpoint is currently active in your actual browser width. No simulated breakpoints, no iframe.


## Install

Install `timeline-lens` as a **devDependency**. It detects GSAP, CSS animations/transitions, and `element.animate()`/WAAPI calls already in your project out of the box, no configuration needed. It must stay a devDependency, never a regular `dependency`, since it's a dev-only tool that should never ship to production (see [Keeping it dev-only](#keeping-it-dev-only) below).

```
npm install --save-dev timeline-lens
```

Or straight from GitHub, using npm's git-subdirectory syntax (requires npm ≥ 7), if you'd rather track a branch or commit directly:

```json
"devDependencies": {
  "timeline-lens": "git+https://github.com/huudi/timeline-lens.git#main?subdir=packages/studio"
}
```

Then install:

```
npm install
```

That's the whole install. There's no config file to create and nothing to point at your source - see [Usage](#usage) below to guard it and open it, and [GSAP support](#gsap-support) if you use GSAP.

## Usage

```js
if (import.meta.env.DEV) {
  import('timeline-lens').then((m) => m.init());
}
```

`init()` resolves gsap if it's installed, then injects a floating trigger button and renders the panel inside a Shadow DOM root, so its styles can't leak into or clash with your page. Click the button to open it. Calling `init()` again while it's already mounted is a no-op.

### Turning it on/off at runtime

Two more exports let you control the studio from your own code instead of the trigger button, useful for wiring it to a keyboard shortcut or a dev-only menu item:

```js
import('timeline-lens').then((m) => {
  // destroy(): fully tears the studio down. Stops detection/ticking,
  // removes its listeners, and unmounts the panel/trigger button. Not
  // just "closed", nothing of it is left mounted. Safe to call even if
  // it isn't currently mounted.
  m.destroy();

  // toggle(): mount if not mounted, destroy() if it is. Handy for a
  // single keybinding:
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F2') m.toggle();
  });
});
```

`init()` can be called again after `destroy()` to remount from a clean state. Detection starts over rather than showing stale entries from the previous mount.

## GSAP support

`gsap` is **not a dependency of timeline-lens**. If you use GSAP, install it the normal way in your own project (as a regular `dependency`, not a devDependency, since GSAP itself does ship to production):

```
npm install gsap
```

There's nothing to configure beyond that. On mount, the studio resolves `gsap` itself via a dynamic `import('gsap')` that's allowed to fail. When it succeeds, GSAP detection (`gsap.globalTimeline`) turns on automatically. When it fails, it falls back to `window.gsap` if that's set (see below). If neither is available, the studio silently runs on CSS/WAAPI detection alone. This dynamic-import approach, rather than a bundled or peer-declared copy, is what guarantees the studio shares the *exact same* `gsap` module instance as your page, which is required for `gsap.globalTimeline` inspection to work at all.

**Loading GSAP from a CDN `<script>` tag instead of npm?** No extra setup needed there either, you don't need to manually expose `window.gsap` yourself. A CDN `<script>` tag already puts GSAP on `window.gsap` as part of loading it, and the studio's `import('gsap')` fails on a page with no npm-installed `gsap` package, so it falls back to reading `window.gsap` automatically. The one thing that must be true either way: it has to be the *same* `gsap` your page's own animations were created with, which a single CDN global always is.

## Where it looks for your code

The Code panel shows your *actual authored source* where possible, not just a synthesized guess, and there's no config for this, no naming convention to follow, and no file list to maintain. It's a fully automatic, same-origin scan:

- It starts from every `<script src="...">` tag already on your page, then follows each file's relative `import`/`export ... from`/dynamic `import()` specifiers, recursively, so code pulled in via your own module graph is found even if it's never a `<script>` tag itself. Bare specifiers (`from 'gsap'`) are left alone; those resolve through your bundler, not a plain fetch.
- `node_modules/` paths and the studio's own package source are always excluded from the crawl.
- Everything else reachable is fetched as plain text (same-origin only, this only works against your own project's dev server, not third-party scripts) and scanned for `gsap.timeline/to/from/fromTo(...)` and `.animate(...)` calls, matched back to a detected animation by its authored `id` (falling back to a target selector).
- CSS `@keyframes` and an element's full matched styling take a different, equally automatic path: they're read straight from `document.styleSheets` (the CSSOM), no fetch involved at all.

If nothing matches, a minified production build, code the crawl can't reach, a cross-origin script, the Code panel falls back to a synthesized snippet instead. Nothing needs to be done manually at install time for any of this; it runs the same way for every project the moment the panel mounts.

## Keeping it dev-only

Two separate mechanisms need to line up for this to never reach production, one at install time, one at build time. Both matter; each one alone leaves a gap.

**1. Install time - it's a `devDependency`.**
As long as it's under `devDependencies` (see [Install](#install)) rather than `dependencies`, a production install that passes `--omit=dev` (or runs with `NODE_ENV=production`, which `npm install`/`npm ci` treat the same way) never pulls the package down at all:

```
npm ci --omit=dev
```

If your deploy pipeline does a plain `npm ci` or `npm install` without that flag, the package still ends up on disk in production, so check your build step for it.

**2. Build time - the guard must be statically analyzable.**
The `if (import.meta.env.DEV)` check isn't just a runtime `if`: Vite (and Rollup/webpack in equivalent setups) replaces `import.meta.env.DEV` with a literal `false` in production builds, which lets the bundler's dead-code elimination drop the entire `import('timeline-lens')` call, and therefore the package itself, out of the production bundle. It's not merely skipped at runtime, it's never shipped.

For this to work, the condition has to be something your bundler can resolve at build time, not a value computed at runtime. If you're not on Vite, use whatever your bundler statically replaces:

```js
// webpack / other bundlers using process.env.NODE_ENV
if (process.env.NODE_ENV !== 'production') {
  import('timeline-lens').then((m) => m.init());
}
```

Don't gate it behind a runtime condition instead (a feature flag read from an API, a query param, `localStorage`, etc.), the bundler can't prove those are always false, so it can't eliminate the import, and the package ships to every production visitor's browser even if the panel never opens for them.

**Verify it, don't just assume it.** After a production build, check that no `timeline-lens` chunk exists in the output (`dist/` or equivalent) and that it doesn't appear in the Network tab when you load the production build in a browser.

## Update

Pull the latest published version:

```
npm update timeline-lens
```

To pin to a specific version instead of always tracking latest, set it directly in `package.json`:

```json
"devDependencies": {
  "timeline-lens": "0.2.0"
}
```

then `npm install` again to pick it up.

## Remove

```
npm uninstall timeline-lens
```

Also delete the `import('timeline-lens')` guard block from your entry point, uninstalling the package alone leaves that dead import in place.

## Browser extension

Same detection engines as this npm package (GSAP, CSS animations, transitions, `element.animate()` and WAAPI), on any page, whether or not it exposes `window.gsap`, no install into your project required. Click the extension icon to mount the panel, click again to toggle it away. Now available on the Chrome Web Store; Firefox support is still in testing, watch this space.

[![Available in the Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-Download-4285F4?logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/timeline-lens/eglipendlnnbdpkbcfnakjncglbeckbp?hl=en-GB&utm_source=ext_sidebar)

## License

[View license](./LICENSE)

## Support

If this saves you time and you'd like to support an indie project, consider buying me a coffee:

<a href="https://www.buymeacoffee.com/huudi" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me a Coffee" style="height: 60px !important;width: 217px !important;" ></a>
