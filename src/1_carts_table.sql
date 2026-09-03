-- Run this in Supabase Dashboard → SQL Editor → New query → Run

create table if not exists public.carts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  items jsonb not null default '{}'::jsonb,   -- { "a02": 2, "b1": 1 }  productId -> quantity
  updated_at timestamptz not null default now(),
  reminder_sent_at timestamptz                -- set once the 48h abandoned-cart email has gone out
);

alter table public.carts enable row level security;

-- A signed-in customer can only ever see/edit their own cart row.
create policy "Users manage their own cart"
  on public.carts
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
