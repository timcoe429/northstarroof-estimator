-- Add unique constraint on estimate_id for upsert support
ALTER TABLE public.ai_project_context
  ADD CONSTRAINT ai_project_context_estimate_id_key UNIQUE (estimate_id);
