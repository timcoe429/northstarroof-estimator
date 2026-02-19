-- Share tokens table for 24-hour shareable review links
CREATE TABLE IF NOT EXISTS public.share_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id uuid NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
  token varchar(32) UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  accessed_at timestamptz,
  is_expired boolean DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_share_tokens_token ON public.share_tokens(token);
CREATE INDEX IF NOT EXISTS idx_share_tokens_expires_at ON public.share_tokens(expires_at);

-- Allow public read access for valid, non-expired share tokens (for share page)
ALTER TABLE public.share_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can select share_tokens (needed for public share links)
CREATE POLICY "share_tokens_select" ON public.share_tokens
  FOR SELECT USING (true);

-- Policy: Only authenticated users in same company can insert share_tokens
CREATE POLICY "share_tokens_insert" ON public.share_tokens
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.estimates e
      JOIN public.profiles p ON p.company_id = e.company_id
      WHERE e.id = estimate_id
      AND p.id = auth.uid()
    )
  );

-- Add customer_name and customer_address to estimates (for CSV flow)
ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS customer_address text;
