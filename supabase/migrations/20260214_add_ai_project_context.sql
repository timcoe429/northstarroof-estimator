-- Add ai_project_context table for AI project manager context tracking
-- Uses company-based ownership (company_id) for access control

-- Create ai_project_context table
CREATE TABLE public.ai_project_context (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id uuid REFERENCES public.estimates(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,

  -- AI's understanding of the project
  project_summary text,
  structure_count integer DEFAULT 1,
  structures jsonb DEFAULT '[]'::jsonb,

  -- AI interaction history
  conversation_log jsonb DEFAULT '[]'::jsonb,
  warnings jsonb DEFAULT '[]'::jsonb,
  validation_status text DEFAULT 'incomplete',

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_ai_context_estimate ON public.ai_project_context(estimate_id);
CREATE INDEX idx_ai_context_company ON public.ai_project_context(company_id);

-- Enable Row Level Security
ALTER TABLE public.ai_project_context ENABLE ROW LEVEL SECURITY;

-- RLS policies: Company-based access
CREATE POLICY "Users can view their company's AI context"
  ON public.ai_project_context FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their company's AI context"
  ON public.ai_project_context FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update their company's AI context"
  ON public.ai_project_context FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their company's AI context"
  ON public.ai_project_context FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Trigger for updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ai_project_context_updated_at
  BEFORE UPDATE ON public.ai_project_context
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
