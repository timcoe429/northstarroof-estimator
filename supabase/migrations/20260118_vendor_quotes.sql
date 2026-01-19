-- Vendor quotes and items for estimates

create table if not exists public.vendor_quotes (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  vendor text not null,
  quote_number text,
  quote_date date,
  project_address text,
  file_name text,
  subtotal numeric,
  tax numeric,
  total numeric,
  created_at timestamp with time zone default now()
);

create index if not exists vendor_quotes_estimate_id_idx on public.vendor_quotes (estimate_id);

create table if not exists public.vendor_quote_items (
  id uuid primary key default gen_random_uuid(),
  vendor_quote_id uuid not null references public.vendor_quotes(id) on delete cascade,
  name text not null,
  unit text,
  price numeric,
  quantity numeric,
  extended_price numeric,
  category text,
  vendor_category text,
  created_at timestamp with time zone default now()
);

create index if not exists vendor_quote_items_vendor_quote_id_idx on public.vendor_quote_items (vendor_quote_id);

alter table public.vendor_quotes enable row level security;
alter table public.vendor_quote_items enable row level security;

-- vendor_quotes policies
create policy "vendor_quotes_select_own_estimate"
on public.vendor_quotes
for select
to authenticated
using (
  exists (
    select 1
    from public.estimates e
    where e.id = vendor_quotes.estimate_id
      and e.user_id = auth.uid()
  )
);

create policy "vendor_quotes_insert_own_estimate"
on public.vendor_quotes
for insert
to authenticated
with check (
  exists (
    select 1
    from public.estimates e
    where e.id = vendor_quotes.estimate_id
      and e.user_id = auth.uid()
  )
);

create policy "vendor_quotes_update_own_estimate"
on public.vendor_quotes
for update
to authenticated
using (
  exists (
    select 1
    from public.estimates e
    where e.id = vendor_quotes.estimate_id
      and e.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.estimates e
    where e.id = vendor_quotes.estimate_id
      and e.user_id = auth.uid()
  )
);

create policy "vendor_quotes_delete_own_estimate"
on public.vendor_quotes
for delete
to authenticated
using (
  exists (
    select 1
    from public.estimates e
    where e.id = vendor_quotes.estimate_id
      and e.user_id = auth.uid()
  )
);

-- vendor_quote_items policies
create policy "vendor_quote_items_select_own_estimate"
on public.vendor_quote_items
for select
to authenticated
using (
  exists (
    select 1
    from public.vendor_quotes vq
    join public.estimates e on e.id = vq.estimate_id
    where vq.id = vendor_quote_items.vendor_quote_id
      and e.user_id = auth.uid()
  )
);

create policy "vendor_quote_items_insert_own_estimate"
on public.vendor_quote_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.vendor_quotes vq
    join public.estimates e on e.id = vq.estimate_id
    where vq.id = vendor_quote_items.vendor_quote_id
      and e.user_id = auth.uid()
  )
);

create policy "vendor_quote_items_update_own_estimate"
on public.vendor_quote_items
for update
to authenticated
using (
  exists (
    select 1
    from public.vendor_quotes vq
    join public.estimates e on e.id = vq.estimate_id
    where vq.id = vendor_quote_items.vendor_quote_id
      and e.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.vendor_quotes vq
    join public.estimates e on e.id = vq.estimate_id
    where vq.id = vendor_quote_items.vendor_quote_id
      and e.user_id = auth.uid()
  )
);

create policy "vendor_quote_items_delete_own_estimate"
on public.vendor_quote_items
for delete
to authenticated
using (
  exists (
    select 1
    from public.vendor_quotes vq
    join public.estimates e on e.id = vq.estimate_id
    where vq.id = vendor_quote_items.vendor_quote_id
      and e.user_id = auth.uid()
  )
);
