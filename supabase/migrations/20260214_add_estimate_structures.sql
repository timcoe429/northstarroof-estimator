-- Add structures column to estimates for per-structure data (Phase 3A)
ALTER TABLE public.estimates 
ADD COLUMN IF NOT EXISTS structures jsonb DEFAULT '[]'::jsonb;
