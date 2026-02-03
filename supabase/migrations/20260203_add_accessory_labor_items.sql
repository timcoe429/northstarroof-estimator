-- Add missing labor items for auto-calculated accessories
-- These items are required for Heat Tape and Snow Fence calculations

-- Heat Tape Install
INSERT INTO public.price_items (id, user_id, name, category, unit, price, coverage, coverage_unit, proposal_description, created_at)
SELECT 
  gen_random_uuid(),
  p.id,
  'Heat Tape Install',
  'labor',
  'lf',
  7.50,
  NULL,
  NULL,
  'Installation of self-regulating heat cable including clips and electrical connection',
  NOW()
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.price_items pi 
  WHERE pi.user_id = p.id 
  AND pi.name = 'Heat Tape Install' 
  AND pi.category = 'labor'
)
ON CONFLICT DO NOTHING;

-- Snow Fence Install
INSERT INTO public.price_items (id, user_id, name, category, unit, price, coverage, coverage_unit, proposal_description, created_at)
SELECT 
  gen_random_uuid(),
  p.id,
  'Snow Fence Install',
  'labor',
  'lf',
  5.00,
  NULL,
  NULL,
  'Installation of snow retention system with clamps and fasteners',
  NOW()
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.price_items pi 
  WHERE pi.user_id = p.id 
  AND pi.name = 'Snow Fence Install' 
  AND pi.category = 'labor'
)
ON CONFLICT DO NOTHING;
