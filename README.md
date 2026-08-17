# KNOCK

**Walk into the world. See what people are building. Knock on a door.**

KNOCK is a multiplayer pixel-art world where builders have their own virtual rooms,
walk around shared spaces, visit friends, knock on doors, and collaborate —
an explorable digital world for people who are actively building things.

The core loop: **Walk → Discover → Knock → Enter → Talk → Collaborate → Leave**

The full product specification lives in [`docs/KNOCK_SPEC.md`](docs/KNOCK_SPEC.md).

## Tech stack

- **Next.js** (App Router) + TypeScript + React
- **Tailwind CSS** for the UI layer around the world
- **Phaser** for the pixel game world (client-side rendering)
- Supabase (auth, PostgreSQL, Realtime) — arriving in Phase 2+
- Deployed on Vercel (preview per branch/PR, production from `main`)

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000 — the pixel world lives at `/world`.

## Connecting Supabase (Phase 2+)

Without Supabase the app runs in **guest mode** (mock data, no accounts).
To enable real accounts, rooms and the database:

1. Create a free project at [supabase.com](https://supabase.com).
2. Copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL` — Project Settings → API → Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Project Settings → API → anon public key
3. Apply the database schema: open the Supabase Dashboard → SQL Editor,
   paste the contents of `supabase/migrations/0001_init.sql`, and run it.
   (This creates the tables, Row Level Security policies, and the trigger
   that gives every new account a profile and a personal room.)
4. Authentication → Providers → Email is enabled by default. For a smooth
   dev flow, disable "Confirm email" under Authentication → Settings while
   testing. Also add your deployment URLs under Authentication → URL
   Configuration if you use magic links later.
5. Add the same two environment variables in Vercel → Project → Settings →
   Environment Variables, then redeploy.

The service-role key is intentionally not used anywhere — the client talks
to Supabase with the anon key and Row Level Security enforces access.

## Development workflow

This project is built phase by phase (see the spec, §42). Every phase:

1. Branch off `develop` as `feature/<area>`
2. Implement, then `npm run lint` + `npm run typecheck` + `npm run build` must pass
3. Commit and push the feature branch (Vercel gives it a preview URL)
4. Open a pull request, review on the preview, merge into `develop`/`main`

## Phase log

| Phase | Branch | What shipped |
| --- | --- | --- |
| 0 | `main` | Project scaffold, CI, spec in repo |
| 1 | `feature/game-world` | Local playable prototype (map, player, doors, knock UI — mock data only) |
| 1.5 | `feature/world-visuals` | Visual upgrade: trees, gardens, lamps, benches, plaza, animated Dawnlike characters |
| 2 | `feature/auth` | Supabase foundation: auth, database schema + RLS migrations, profiles & auto-provisioned rooms, signed-in identity in the world |
| 3 | `feature/realtime` | Realtime multiplayer: presence, throttled movement broadcast, interpolated remote players (guests included) |
| 4 | `feature/rooms` | Real rooms & doors: world slots filled from the database, live door-state updates (DB + realtime), player status/activity panel |

## Asset licenses

All sprites and tiles must be original or permissively licensed (no copied game assets).
Prototype art uses CC0 asset packs — sources are documented in `public/sprites/CREDITS.md`.

## Security

- Never commit secrets. Use `.env.example` as the template.
- Row Level Security and server-side validation arrive with the Supabase phase.
