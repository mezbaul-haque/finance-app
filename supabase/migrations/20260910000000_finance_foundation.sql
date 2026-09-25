-- Personal finance tracker foundation.
-- Run this migration in the Supabase SQL editor or through the Supabase CLI.

create type public.transaction_kind as enum ('income', 'expense', 'transfer');
create type public.account_kind as enum ('cash', 'bank', 'mobile_wallet', 'credit_card', 'investment', 'other');
create type public.purchase_decision_status as enum ('considering', 'bought', 'skipped', 'deferred');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  currency_code text not null default 'BDT' check (currency_code ~ '^[A-Z]{3}$'),
  monthly_income_target numeric(14, 2) check (monthly_income_target is null or monthly_income_target >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  kind public.account_kind not null default 'bank',
  opening_balance numeric(14, 2) not null default 0,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  kind public.transaction_kind not null check (kind in ('income', 'expense')),
  color text not null default '#64748b' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  icon text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name, kind)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  kind public.transaction_kind not null,
  amount numeric(14, 2) not null check (amount > 0),
  occurred_on date not null default current_date,
  merchant text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind = 'transfer' or category_id is not null)
);

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  month_start date not null check (month_start = date_trunc('month', month_start)::date),
  amount numeric(14, 2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, category_id, month_start)
);

-- A proposal preserves the reasoning and outcome of a purchase decision.
-- Future assistant features can use this history alongside transactions.
create table public.purchase_decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0),
  price numeric(14, 2) not null check (price >= 0),
  is_recurring boolean not null default false,
  recurring_interval_months integer check (recurring_interval_months is null or recurring_interval_months > 0),
  priority smallint not null default 3 check (priority between 1 and 5),
  target_category_id uuid references public.categories(id) on delete set null,
  desired_by date,
  user_notes text,
  recommendation text,
  status public.purchase_decision_status not null default 'considering',
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((is_recurring and recurring_interval_months is not null) or not is_recurring)
);

create index transactions_user_occurred_on_idx on public.transactions (user_id, occurred_on desc);
create index transactions_user_category_idx on public.transactions (user_id, category_id);
create index budgets_user_month_start_idx on public.budgets (user_id, month_start desc);
create index purchase_decisions_user_status_idx on public.purchase_decisions (user_id, status, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Foreign keys verify that a record exists; this trigger also verifies that it
-- belongs to the same person and that its category matches the record's use.
create or replace function public.validate_finance_relationships()
returns trigger
language plpgsql
as $$
declare
  related_user_id uuid;
  related_kind public.transaction_kind;
begin
  if tg_table_name = 'transactions' then
    if new.account_id is not null then
      select user_id into related_user_id from public.accounts where id = new.account_id;
      if related_user_id is distinct from new.user_id then
        raise exception 'Account must belong to the transaction owner';
      end if;
    end if;

    if new.category_id is not null then
      select user_id, kind into related_user_id, related_kind from public.categories where id = new.category_id;
      if related_user_id is distinct from new.user_id then
        raise exception 'Category must belong to the transaction owner';
      end if;
      if related_kind is distinct from new.kind then
        raise exception 'Category type must match transaction type';
      end if;
    end if;
  elsif tg_table_name = 'budgets' then
    select user_id, kind into related_user_id, related_kind from public.categories where id = new.category_id;
    if related_user_id is distinct from new.user_id or related_kind <> 'expense' then
      raise exception 'Budgets require an expense category owned by the budget owner';
    end if;
  elsif tg_table_name = 'purchase_decisions' and new.target_category_id is not null then
    select user_id, kind into related_user_id, related_kind from public.categories where id = new.target_category_id;
    if related_user_id is distinct from new.user_id or related_kind <> 'expense' then
      raise exception 'Purchase decisions require an expense category owned by the decision owner';
    end if;
  end if;

  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger accounts_set_updated_at before update on public.accounts for each row execute function public.set_updated_at();
create trigger categories_set_updated_at before update on public.categories for each row execute function public.set_updated_at();
create trigger transactions_set_updated_at before update on public.transactions for each row execute function public.set_updated_at();
create trigger budgets_set_updated_at before update on public.budgets for each row execute function public.set_updated_at();
create trigger purchase_decisions_set_updated_at before update on public.purchase_decisions for each row execute function public.set_updated_at();
create trigger transactions_validate_relationships before insert or update on public.transactions for each row execute function public.validate_finance_relationships();
create trigger budgets_validate_relationships before insert or update on public.budgets for each row execute function public.validate_finance_relationships();
create trigger purchase_decisions_validate_relationships before insert or update on public.purchase_decisions for each row execute function public.validate_finance_relationships();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');

  insert into public.categories (user_id, name, kind, color, icon)
  values
    (new.id, 'Salary', 'income', '#16a34a', 'briefcase'),
    (new.id, 'Freelance', 'income', '#0891b2', 'laptop'),
    (new.id, 'Other income', 'income', '#4f46e5', 'plus'),
    (new.id, 'Housing', 'expense', '#7c3aed', 'home'),
    (new.id, 'Food', 'expense', '#ea580c', 'utensils'),
    (new.id, 'Transport', 'expense', '#2563eb', 'car'),
    (new.id, 'Utilities', 'expense', '#ca8a04', 'zap'),
    (new.id, 'Health', 'expense', '#dc2626', 'heart-pulse'),
    (new.id, 'Education', 'expense', '#0284c7', 'book-open'),
    (new.id, 'Entertainment', 'expense', '#db2777', 'film'),
    (new.id, 'Shopping', 'expense', '#9333ea', 'shopping-bag'),
    (new.id, 'Other expense', 'expense', '#64748b', 'more-horizontal');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;
alter table public.purchase_decisions enable row level security;

create policy "Users manage their own profile" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy "Users manage their own accounts" on public.accounts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users manage their own categories" on public.categories for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users manage their own transactions" on public.transactions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users manage their own budgets" on public.budgets for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users manage their own purchase decisions" on public.purchase_decisions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
