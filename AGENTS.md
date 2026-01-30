# AGENTS.md

This file orients coding agents to the repo. Read it first.

## Project structure (high priority)
- `system.json`: Foundry system manifest (entrypoints, packs, styles).
- `module/entrypoint.js`: main Foundry entrypoint (Hooks init/ready).
- `module/constants.js`: system-wide constants.
- `module/active-effects/`: Active Effect automation helpers.
- `module/config/`: configuration and static action data.
- `module/dev/`: debug utilities and diagnostics.
- `module/dialogs/`: dialog/modal logic.
- `module/entities/`: Actor/Item/Combat extensions.
- `module/handlers/`: Foundry lifecycle hooks (init/startup).
- `module/helpers/`: shared utilities (authority-proxy, dice, strings).
- `module/maps/`: lookup tables/mappings (e.g., characteristics).
- `module/migrations/`: actor/item migrations (schema repair).
- `module/sheets/`: sheet controllers and UI wiring.
- `module/systems/`: rules subsystems (combat, magic, conditions, skills, traits, stamina, wounds, etc.).
- `templates/`: Handlebars/HTML templates for sheets and UI.
- `templates/partials/`: shared template fragments.
- `styles/`: system CSS files.
- `packs/`: compiled compendiums (binary LevelDB output).
- `packs/src/`: YAML sources for compendium content.
- `automation/`: release and compendium tooling (packager, versioning).
- `docs/`: rulebook and system documentation.
- `.github/`: GitHub workflow/issue templates.

## Build, lint, test
No dedicated build, lint, or test runner is configured in this repo. The only
automation scripts relate to compendium packs and release tooling.

### Install
- `npm install` (used by CI for pack compilation only)

### Compendium pack tooling
- Compile all packs: `node ./automation/ldb-packager.mjs compile`
- Extract all packs: `node ./automation/ldb-packager.mjs extract`
- Extract with clean: `node ./automation/ldb-packager.mjs extract --clean`
- Clean compiled packs: `node ./automation/ldb-packager.mjs clean`

### Single pack compile/extract
The packager script accepts a pack name after the command.
- Compile a single pack: `node ./automation/ldb-packager.mjs compile <packName>`
- Extract a single pack: `node ./automation/ldb-packager.mjs extract <packName>`

### Tests
There is no automated test runner. “Single test” guidance:
- For logic changes, validate in Foundry VTT by loading the system and
  exercising the affected workflow manually (e.g., a specific roll or dialog).
- For compendium edits, compile or extract only the target pack using the
  single-pack commands above.

### Lint/format
No eslint/prettier configuration is present. Use the existing style in files
and follow `.editorconfig` (2-space indent, LF, trim trailing whitespace).

## Code style and conventions
### Imports and modules
- ES module syntax (`import ... from` / `export ...`).
- Prefer relative imports with explicit file extensions (`.js`).
- Group imports by local feature area (helpers, systems, sheets, etc.).

### Formatting
- Follow `.editorconfig`: 2-space indent for `.js`, LF line endings.
- Keep lines readable; avoid large refactors for formatting alone.
- Use ASCII only unless an existing file uses Unicode and it is necessary.

### Naming
- Files: kebab-case for modules and helpers (e.g., `damage-automation.js`).
- Classes: PascalCase (`SimpleActor`, `AttackTracker`).
- Functions/vars: camelCase; constants in UPPER_SNAKE_CASE.
- Foundry system IDs and flags use `uesrpg-3ev4` as scope.

### Foundry patterns
- Use `Hooks.once("init")`/`Hooks.once("ready")` in `module/entrypoint.js`.
- Prefer Foundry document update APIs (`update`, `updateSource`,
  `createEmbeddedDocuments`, etc.) over direct mutation.
- For permissions/authority-sensitive changes, route through
  `module/helpers/authority-proxy.js` when needed.

### Data safety and migrations
- Derived data scaffolding should not mutate schema or embedded collections.
- Persisted schema changes belong in `module/migrations/`.
- When hardening against legacy data, use safe defaults and guard clauses.

### Error handling and logging
- Use `try/catch` around multi-step Foundry operations to avoid cascading UI
  failures; log with `console.error` using the system prefix `uesrpg-3ev4`.
- Avoid swallowing errors silently unless a safe fallback is applied.

### Active Effects and flags
- Use system-scoped flags under `flags.uesrpg-3ev4` for custom metadata.
- Keep effect definitions minimal and deterministic; do not introduce schema
  changes in effect automation.

### Templates and CSS
- Templates live in `templates/` and partials in `templates/partials/`.
- CSS is plain `.css` under `styles/` (no build step).

## Release workflow notes (CI)
- GitHub Action tags (`v*`) create a release and compile packs.
- Pack compilation in CI uses `npm install` + `node ./automation/ldb-packager.mjs compile`.

## Cursor/Copilot rules
- No `.cursor/rules/`, `.cursorrules`, or `.github/copilot-instructions.md` found.

## File map quick reference
- Entry: `module/entrypoint.js`
- Core entities: `module/entities/actor.js`, `module/entities/item.js`
- Migrations: `module/migrations/actors.js`, `module/migrations/items.js`
- Helpers: `module/helpers/`
- Rules subsystems: `module/systems/`
- Sheets: `module/sheets/`
- Packs: `packs/` + YAML sources in `packs/src/`
