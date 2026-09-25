# Current state

Last updated: 2026-09-11

## Completed

- React, TypeScript, and Vite application scaffold
- Supabase browser client with typed environment variables
- Initial database migration for profiles, accounts, categories, transactions, budgets, and purchase decisions
- Row-level security and ownership validation for financial data
- Automatic default categories for every newly registered user
- Environment-variable example and project setup instructions
- Email/password sign-up and sign-in screen
- Session restoration, sign-out, and a protected application shell

## Pending external setup

- Run `supabase/migrations/20260910000000_finance_foundation.sql` in the target Supabase project.
- Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local`.

## Current UI

The starter screen has been replaced with authentication. Signed-in users see a protected onboarding shell; it does not yet read or write finance data.

## Next agreed task

Implement the first finance-data workflow: create an account, add a transaction, and list recent transactions for the signed-in user.

## Known constraints

- Database migrations exist in the repository but have not been applied to a remote Supabase project.
- The current Supabase client throws at startup if its two required environment variables are missing.
- Email confirmation and permitted redirect URLs are configured in the target Supabase project's Authentication settings.
