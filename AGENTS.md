# Working in this repository

Before changing code, read `README.md`, `docs/product.md`, and `docs/current-state.md`. Then inspect `git status` and recent commits. Treat those files as the durable project context; update them when a material product or implementation decision changes.

## Stack and commands

- React 19, TypeScript, Vite, Tailwind CSS, and Recharts
- Supabase for authentication and the database
- `npm run lint` checks linting
- `npm run build` type-checks and creates a production build

## Engineering rules

- Keep personal financial data scoped to the authenticated user.
- Do not expose Supabase secrets or commit `.env.local`.
- Make migrations additive. Do not alter an already-applied migration; create a new one instead.
- Use TypeScript types at boundaries with Supabase data.
- Prefer small, focused changes. Preserve unrelated work in a dirty working tree.
- Test relevant changes with lint and build before handoff.

## Product guardrails

- This app provides decision support, not professional financial advice.
- Recommendations must be explainable from the user's recorded data and stated assumptions.
- Never present a recommendation as guaranteed or silently make a financial decision for the user.

## New-chat prompt

Use this in a new coding-agent chat:

> Read `README.md`, `AGENTS.md`, `docs/product.md`, and `docs/current-state.md`. Inspect `git status` and recent commits. Summarize your understanding before changing code, then implement the next agreed task.
