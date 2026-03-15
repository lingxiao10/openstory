
# Project Memory

## Project Structure & Conventions
- React application with JSX source in a separate `.jsx` file (`mystery-card-game.jsx`).
- `index.html` serves as the loader/host page — it loads CDN dependencies and dynamically fetches, compiles, and runs the JSX file.
- **The `.jsx` file must NOT be modified.** It uses standard ES Module syntax (`import`/`export default`) and is treated as a read-only source.
- No build step, no package manager (`npm`/`yarn`) required.

## Core Implementation Strategy
1. **React CDN Integration:** React 18, ReactDOM 18, and `@babel/standalone` are imported via `unpkg.com` in the HTML `<head>`.
2. **Runtime JSX Compilation:** `index.html` uses `fetch()` to load the `.jsx` file as text, then compiles it with `Babel.transform()` using presets `['react', 'env']` and plugin `['proposal-optional-chaining']`.
3. **CommonJS Shim:** Since Babel converts ES Module `import`/`export` to CommonJS `require()`/`module.exports`, `index.html` provides:
   - A `require()` function that maps `'react'` → `window.React`, `'react-dom'` → `window.ReactDOM`.
   - A `module`/`exports` object to capture the `export default` component.
4. **Sandboxed Execution:** Compiled code runs inside `new Function('require', 'module', 'exports', compiledCode)` to inject the CommonJS shim.
5. **DOM Rendering:** The exported App component is mounted via `ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App))`.

## Important Notes
- The page **must be served via HTTP** (e.g., `npx serve`, `python -m http.server`), not opened via `file://` protocol, because `fetch()` requires it.
- The `.jsx` file uses optional chaining (`?.`), so the Babel plugin `proposal-optional-chaining` is needed.

## Styling
- Component-scoped inline styles defined in a `S` object inside the JSX file.
- Basic reset and global styling in `<style>` block in `index.html`.

## Key Files
- `mystery-card-game.jsx` — React game component (standard ES Module syntax)
- `index.html` — Host page that loads, compiles, and runs the JSX file

## Modifications History
- Disabled `cardIn` animation (slide-in + scale) so cards appear instantly without motion. The `@keyframes cardIn` was changed to static `opacity:1; transform:none` in both `from` and `to`.
- Fixed rotation jump bug: removed `transform: none` from `@keyframes cardIn` and changed to a simple fade-in (`opacity: 0` to `opacity: 1`). This ensures the inline `transform: rotate(...)` applied to cards is not overridden during the animation.
