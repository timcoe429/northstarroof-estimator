import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import {
  loadKnowledgeBase,
  detectStructures,
  validateMaterialSelection,
  validateEstimateCompleteness,
  generatePreflightCheck,
} from '@/lib/ai/project-manager';
import type { AIProjectContext, Estimate, LineItem, AIDetectedStructure } from '@/types';

const COMPANY_ID = '00000000-0000-0000-0000-000000000001';

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

export async function POST(request: Request) {
  try {
    const { operation, data } = await request.json();

    const knowledgeBase = loadKnowledgeBase();

    switch (operation) {
      case 'detect-structures': {
        const detection = await detectStructures(data.images, knowledgeBase);

        if (data.estimateId) {
          await supabase.from('ai_project_context').upsert(
            {
              estimate_id: data.estimateId,
              company_id: COMPANY_ID,
              project_summary: detection.summary,
              structure_count: detection.structures.length,
              structures: detection.structures,
              validation_status: 'incomplete',
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'estimate_id' }
          );
        }

        return NextResponse.json({ success: true, data: detection });
      }

      case 'validate-materials': {
        const materialValidation = await validateMaterialSelection(
          data.structures,
          data.selectedItems,
          knowledgeBase
        );

        await supabase
          .from('ai_project_context')
          .update({
            warnings: materialValidation.warnings,
            validation_status: materialValidation.valid ? 'ready' : 'warnings',
            updated_at: new Date().toISOString(),
          })
          .eq('estimate_id', data.estimateId);

        return NextResponse.json({ success: true, data: materialValidation });
      }

      case 'validate-completeness': {
        const { data: aiContextRow, error: fetchError } = await supabase
          .from('ai_project_context')
          .select('*')
          .eq('estimate_id', data.estimateId)
          .single();

        if (fetchError || !aiContextRow) {
          return NextResponse.json(
            { success: false, error: 'AI context not found for this estimate' },
            { status: 404 }
          );
        }

        const aiContext = mapRowToContext(aiContextRow);
        const completenessValidation = await validateEstimateCompleteness(
          data.estimate as Estimate,
          aiContext,
          knowledgeBase
        );

        await supabase
          .from('ai_project_context')
          .update({
            warnings: completenessValidation.warnings,
            validation_status: completenessValidation.valid ? 'ready' : 'warnings',
            updated_at: new Date().toISOString(),
          })
          .eq('estimate_id', data.estimateId);

        return NextResponse.json({ success: true, data: completenessValidation });
      }

      case 'preflight-check': {
        const { data: preflightRow, error: preflightError } = await supabase
          .from('ai_project_context')
          .select('*')
          .eq('estimate_id', data.estimateId)
          .single();

        if (preflightError || !preflightRow) {
          return NextResponse.json(
            { success: false, error: 'AI context not found' },
            { status: 404 }
          );
        }

        const preflightContext = mapRowToContext(preflightRow);
        const preflight = await generatePreflightCheck(
          data.estimate as Estimate,
          preflightContext,
          knowledgeBase
        );

        return NextResponse.json({ success: true, data: preflight });
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid operation' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('AI Project Manager API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
