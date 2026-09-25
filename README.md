# Finance App

A personal finance tracker designed to turn income, spending, and purchase intentions into clearer decisions.

## Current foundation

The first Supabase migration creates the data model for profiles, accounts, categories, transactions, monthly budgets, and purchase decisions. Every table is protected by row-level security and is scoped to the signed-in user.

Purchase decisions are retained separately from transactions so the app can later explain recommendations using actual spending patterns and the eventual outcome.

## Setup

1. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
2. In the Supabase dashboard, open the SQL Editor and run [the foundation migration](supabase/migrations/20260910000000_finance_foundation.sql).
3. Install dependencies and start the app:

   ```bash
   npm install
   npm run dev
   ```

## Development checks

```bash
npm run lint
npm run build
```

## Project context for coding assistants

Start with [AGENTS.md](AGENTS.md), [the product brief](docs/product.md), and [the current-state record](docs/current-state.md). They capture the durable context needed to continue work in a fresh chat.
