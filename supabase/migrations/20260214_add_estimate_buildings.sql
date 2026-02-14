-- Add buildings column for per-building state (Phase B: Setup/Build/Review)
ALTER TABLE public.estimates 
ADD COLUMN IF NOT EXISTS buildings jsonb DEFAULT NULL;
