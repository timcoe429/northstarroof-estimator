ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS buildings JSONB DEFAULT NULL;
COMMENT ON COLUMN public.estimates.buildings IS 'Array of BuildingEstimate objects for multi-building quotes. NULL for legacy single-building quotes.';
