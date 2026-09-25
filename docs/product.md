# Product brief

## Purpose

Finance App is a personal finance tracker and purchase-decision helper. It should help one person understand their income, expenses, and habits, then use that context to evaluate potential purchases.

## MVP user flows

1. A user creates an account and signs in.
2. They record income and expenses against an account and category.
3. They review monthly income, spending, balance, and category totals.
4. They set category budgets and see when their spending approaches them.
5. They save a possible purchase and receive an explainable assessment based on their finances, budget, and previous behaviour.

## MVP scope

- Email/password authentication
- Accounts, categories, income, expenses, and monthly budgets
- Transaction create, edit, delete, and filtering
- Monthly dashboard with spending-by-category insight
- Purchase-decision records and transparent recommendations

## Non-goals for the first release

- Bank connections or automatic transaction imports
- Shared household accounts or multi-user budgets
- Investment or tax advice
- Automated financial actions
- Predictions presented as guarantees

## Product decisions

- Start as a single-user application; every record is owned by one authenticated user.
- Default currency is BDT, stored as a three-letter currency code for future flexibility.
- Supabase provides the backend, authentication, and row-level security.
- The app is decision support only. Recommendations should cite the inputs and assumptions used.
