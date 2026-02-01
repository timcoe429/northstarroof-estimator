-- Add missing columns to estimates table for quote save/load

alter table public.estimates 
add column if not exists sundries_percent numeric default 10,
add column if not exists waste_percent numeric default 10,
add column if not exists job_description text;
