-- Allow unauthenticated users to read an estimate when a valid, non-expired share token exists.
-- Required for public share links (/share/[token]) to work.
CREATE POLICY "estimates_select_via_share_token"
ON public.estimates
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.share_tokens
    WHERE share_tokens.estimate_id = estimates.id
      AND share_tokens.expires_at > now()
  )
);
