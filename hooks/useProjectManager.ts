import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type {
  AIProjectContext,
  AIDetectedStructure,
  AIValidationResult,
  LineItem,
  Estimate,
} from '@/types';

function mapRowToContext(row: Record<string, unknown>): AIProjectContext {
  return {
    id: row.id as string,
    estimateId: row.estimate_id as string,
    companyId: row.company_id as string,
    projectSummary: (row.project_summary as string) || '',
    structureCount: (row.structure_count as number) || 1,
    structures: (row.structures as AIDetectedStructure[]) || [],
    conversationLog: (row.conversation_log as AIProjectContext['conversationLog']) || [],
    warnings: (row.warnings as AIProjectContext['warnings']) || [],
    validationStatus: (row.validation_status as AIProjectContext['validationStatus']) || 'incomplete',
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function useProjectManager(estimateId: string | null) {
  const [aiContext, setAiContext] = useState<AIProjectContext | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadContext = useCallback(async () => {
    if (!estimateId) return;

    try {
      setIsLoading(true);
      const { data, error: fetchError } = await supabase
        .from('ai_project_context')
        .select('*')
        .eq('estimate_id', estimateId)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          setAiContext(null);
          return;
        }
        throw fetchError;
      }

      setAiContext(mapRowToContext(data as Record<string, unknown>));
    } catch (err) {
      console.error('Load AI context error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load AI context');
    } finally {
      setIsLoading(false);
    }
  }, [estimateId]);

  useEffect(() => {
    if (!estimateId) {
      setAiContext(null);
      setError(null);
      return;
    }
    loadContext();
  }, [estimateId, loadContext]);

  async function detectStructures(images: string[]) {
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/project-manager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'detect-structures',
          data: { images, estimateId },
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Detection failed');
      }

      if (estimateId) {
        await loadContext();
      }

      return result.data;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Detection failed';
      setError(errorMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }

  async function validateMaterials(
    structures: AIDetectedStructure[],
    selectedItems: LineItem[]
  ): Promise<AIValidationResult> {
    if (!estimateId) {
      throw new Error('No estimate ID provided');
    }

    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/project-manager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'validate-materials',
          data: { estimateId, structures, selectedItems },
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Validation failed');
      }

      await loadContext();

      return result.data;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Material validation failed';
      setError(errorMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }

  async function validateCompleteness(estimate: Estimate): Promise<AIValidationResult> {
    if (!estimateId) {
      throw new Error('No estimate ID provided');
    }

    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/project-manager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'validate-completeness',
          data: { estimateId, estimate },
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Completeness validation failed');
      }

      await loadContext();

      return result.data;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Completeness validation failed';
      setError(errorMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }

  async function runPreflightCheck(
    estimate: Estimate
  ): Promise<{ ready: boolean; warnings: AIProjectContext['warnings']; introLetterSuggestions: string }> {
    if (!estimateId) {
      throw new Error('No estimate ID provided');
    }

    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/project-manager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'preflight-check',
          data: { estimateId, estimate },
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Preflight check failed');
      }

      return result.data;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Preflight check failed';
      setError(errorMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }

  async function dismissWarning(warningId: string) {
    if (!aiContext || !estimateId) return;

    try {
      const updatedWarnings = aiContext.warnings.map((w) =>
        w.id === warningId ? { ...w, dismissed: true } : w
      );

      await supabase
        .from('ai_project_context')
        .update({ warnings: updatedWarnings })
        .eq('estimate_id', estimateId);

      setAiContext({
        ...aiContext,
        warnings: updatedWarnings,
      });
    } catch (err) {
      console.error('Dismiss warning error:', err);
    }
  }

  return {
    aiContext,
    isLoading,
    error,
    detectStructures,
    validateMaterials,
    validateCompleteness,
    runPreflightCheck,
    dismissWarning,
    refresh: loadContext,
  };
}
