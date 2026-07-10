# lukasvan3l

Lukas' plekkie — a place for **publicly hosting one-offs**: small, standalone
pages and projects that each live in their own top-level directory.

## How this repo is organised

- Each top-level directory is an **independent, self-contained one-off**
  (e.g. `slovenie/`). They do not share code, build tooling, or dependencies.
- Directories are unrelated to each other. Treat each one as its own little
  project.
- The repo is published with **GitHub Pages** at
  <https://apps.3l.nl/> (custom domain). The root `index.html` is the landing
  page: a tiled navigation linking to each app (e.g. `slovenie/`).

## Working rules for Claude

- **Stay in one directory.** When you're working inside a directory, do not
  read, reference, or modify files in other directories. What happens in
  `slovenie/` has nothing to do with any other one-off.
- **Every directory has its own `CLAUDE.md`.** When you create a new
  directory for a one-off, also create a `CLAUDE.md` in it describing what
  that one-off is and any project-specific notes. Read that file (not this
  root one) for context when working inside the directory.
- **Every app must be linked from the root landing page.** When you add a new
  one-off directory, add a tile for it in the root `index.html` so it's
  reachable from <https://apps.3l.nl/>. (The root `index.html`
  is the one place that's allowed to reference every directory.)
- This root `CLAUDE.md` only describes the repo as a whole. For anything
  concrete, defer to the directory-level `CLAUDE.md`.
