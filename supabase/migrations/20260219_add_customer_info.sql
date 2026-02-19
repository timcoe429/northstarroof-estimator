-- Add customer_info JSONB column for estimate display (name, address from CSV)
ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS customer_info jsonb DEFAULT NULL;

COMMENT ON COLUMN public.estimates.customer_info IS 'Stores {name, address} for estimate display from CSV';
