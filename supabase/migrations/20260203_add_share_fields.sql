-- Add share fields to estimates table for shareable links

alter table public.estimates 
add column if not exists share_token text unique,
add column if not exists share_enabled boolean default false;

-- Create index on share_token for faster lookups
create index if not exists idx_estimates_share_token on public.estimates(share_token) where share_token is not null;
