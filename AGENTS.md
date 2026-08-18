<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# KNOCK — Project Guide for AI Agents (Codex, Claude, etc.)

KNOCK is a multiplayer pixel-art world for builders. Full product spec: `docs/KNOCK_SPEC.md`.

## Stack
Next.js 16 (App Router) + TypeScript + Tailwind CSS + Phaser (game canvas, Canvas2D renderer) + Supabase (auth/DB/realtime). Phaser is v4 — RenderTexture draws are buffered and need `rt.render()`.

## Map of the code
- `src/app/` — pages. `/world` is the game (server component → `WorldClient` → `GameShell`)
- `src/components/` — React HUD/dialogs (GameShell is the big one)
- `src/game/` — Phaser engine: `scenes/` (World/Room/Boot), `net/RealtimeService.ts` (presence + broadcast), `worldData.ts` (map layout), `EventBus.ts` (Phaser↔React bridge)
- `src/lib/` — Supabase clients + data fetches; `supabase/migrations/` — DB schema (RLS everywhere)
- `public/sprites/` — pixel art. LPC (CC-BY-SA), Kenney (CC0), DawnLike (CC-BY) — see `public/sprites/CREDITS.md`. Never copy assets from commercial games.

## Hard rules
1. Never commit secrets: `.env.local`, passwords, service keys. Only `.env.example` (empty values) is committed.
2. The git workflow is: branch `feature/<name>` from `develop` → commit → push → PR to `main` → CI must pass → merge. No direct commits to `main`.
3. Validation gate before any commit: `npm run lint && npm run typecheck && npm run build` — all must pass.
4. One task per branch; don't mix unrelated changes into a PR.
5. Movement/position data is NEVER written to the database (ephemeral by design — spec §16). Chat/knocks/notes/rooms DO persist.
6. Treat all client data as untrusted; RLS policies are the security boundary (spec §33).

## Commands
- `npm run dev` (port 3000 or next free) · `npm run lint` · `npm run typecheck` · `npm run build`
