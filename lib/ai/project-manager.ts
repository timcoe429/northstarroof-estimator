/**
 * AI Project Manager - Core logic for structure detection, material validation,
 * and estimate completeness checking. Uses Claude API with knowledge base context.
 */

import fs from 'fs';
import path from 'path';
import type {
  AIDetectedStructure,
  AIProjectContext,
  AIWarning,
  AIValidationResult,
  LineItem,
  Estimate,
  Measurements,
} from '@/types';

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

let cachedKB: string | null = null;

/**
 * Load and combine all knowledge base markdown files. Results are cached.
 */
export function loadKnowledgeBase(): string {
  if (cachedKB) return cachedKB;

  const basePath = path.join(process.cwd(), 'lib', 'knowledge');
  const files = ['roofing-rules.md', 'multi-structure-rules.md', 'validation-rules.md'];

  const parts: string[] = [];
  for (const file of files) {
    const filePath = path.join(basePath, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    parts.push(`\n\n---\n\n# ${file}\n\n${content}`);
  }

  cachedKB = parts.join('');
  return cachedKB;
}

/**
 * Call Anthropic Claude API with system prompt and messages.
 */
export async function callClaudeAPI(
  messages: { role: string; content: unknown }[],
  systemPrompt: string
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API error (${response.status}): ${errorText.slice(0, 200)}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text;
  if (typeof text !== 'string') {
    throw new Error('Invalid Claude API response: missing content');
  }
  return text;
}

/**
 * Safely parse JSON from AI response. Handles markdown code fences.
 */
export function parseAIResponse<T>(response: string): T {
  let jsonText = response.trim();
  if (jsonText.includes('```')) {
    const match = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match) {
      jsonText = match[1];
    }
  }
  try {
    return JSON.parse(jsonText) as T;
  } catch (e) {
    throw new Error(`Failed to parse AI response: ${(e as Error).message}. Excerpt: ${jsonText.slice(0, 100)}...`);
  }
}

/**
 * Generate unique ID for warnings.
 */
export function generateWarningId(): string {
  return `warn_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

const DEFAULT_MEASUREMENTS: Measurements = {
  total_squares: 0,
  predominant_pitch: '',
  ridge_length: 0,
  hip_length: 0,
  valley_length: 0,
  eave_length: 0,
  rake_length: 0,
  penetrations: 0,
  skylights: 0,
  chimneys: 0,
  complexity: '',
};

function normalizeMeasurements(m: Partial<Measurements> | undefined): Measurements {
  if (!m) return { ...DEFAULT_MEASUREMENTS };
  return {
    total_squares: m.total_squares ?? 0,
    predominant_pitch: m.predominant_pitch ?? '',
    ridge_length: m.ridge_length ?? 0,
    hip_length: m.hip_length ?? 0,
    valley_length: m.valley_length ?? 0,
    eave_length: m.eave_length ?? 0,
    rake_length: m.rake_length ?? 0,
    penetrations: m.penetrations ?? 0,
    skylights: m.skylights ?? 0,
    chimneys: m.chimneys ?? 0,
    complexity: m.complexity ?? '',
  };
}

// -----------------------------------------------------------------------------
// detectStructures
// -----------------------------------------------------------------------------

export async function detectStructures(
  roofScopeImages: string[],
  knowledgeBase: string
): Promise<{
  structures: AIDetectedStructure[];
  summary: string;
  confidence: 'high' | 'medium' | 'low';
}> {
  try {
    const content: unknown[] = [];

    for (const item of roofScopeImages.slice(0, 5)) {
      const base64Data = item.includes(',') ? item.split(',')[1] : item;
      if (item.startsWith('data:application/pdf')) {
        content.push({
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: base64Data,
          },
        });
      } else {
        const mediaType = item.includes('data:image/')
          ? item.split(';')[0].split(':')[1]
          : 'image/png';
        content.push({
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: base64Data },
        });
      }
    }

    const prompt = `Analyze this RoofScope document or these images. Apply the multi-structure detection rules above.

Return ONLY valid JSON in this exact format (no markdown, no commentary):
{
  "structures": [
    {
      "id": "structure-1",
      "name": "Main House",
      "type": "metal" | "tile" | "shingle" | "flat" | "unknown",
      "measurements": {
        "total_squares": 39.65,
        "predominant_pitch": "6/12",
        "ridge_length": 120,
        "hip_length": 0,
        "valley_length": 45,
        "eave_length": 85,
        "rake_length": 60,
        "penetrations": 3,
        "skylights": 0,
        "chimneys": 0,
        "complexity": "Moderate"
      },
      "hasAnalysisPage": true,
      "confidence": "high" | "medium" | "low"
    }
  ],
  "summary": "Brief project summary",
  "confidence": "high" | "medium" | "low"
}

Use 0 for measurements not visible. Set hasAnalysisPage based on whether you have detailed analysis for each structure.`;

    content.push({ type: 'text', text: prompt });

    const systemPrompt = knowledgeBase?.trim()
      ? knowledgeBase
      : loadKnowledgeBase();

    const text = await callClaudeAPI(
      [{ role: 'user', content }],
      systemPrompt
    );

    const parsed = parseAIResponse<{
      structures?: Array<Partial<AIDetectedStructure> & { measurements?: Partial<Measurements> }>;
      summary?: string;
      confidence?: 'high' | 'medium' | 'low';
    }>(text);

    const structures: AIDetectedStructure[] = (parsed.structures || []).map((s, i) => ({
      id: s.id || `structure-${i + 1}`,
      name: s.name || `Structure ${i + 1}`,
      type: s.type || 'unknown',
      measurements: normalizeMeasurements(s.measurements),
      hasAnalysisPage: s.hasAnalysisPage ?? false,
      confidence: s.confidence || 'medium',
    }));

    return {
      structures,
      summary: parsed.summary || 'Analysis complete',
      confidence: parsed.confidence || 'medium',
    };
  } catch (error) {
    console.error('detectStructures error:', error);
    return {
      structures: [],
      summary: 'Detection failed',
      confidence: 'low',
    };
  }
}

// -----------------------------------------------------------------------------
// validateMaterialSelection
// -----------------------------------------------------------------------------

export async function validateMaterialSelection(
  structures: AIDetectedStructure[],
  selectedItems: LineItem[],
  knowledgeBase: string
): Promise<AIValidationResult> {
  try {
    const itemNames = selectedItems.map((i) => i.name).join(', ');
    const structureSummary = structures
      .map((s) => `${s.name}: ${s.type} (${s.measurements.total_squares} sq)`)
      .join('; ');

    const roofingRules = knowledgeBase.includes('Material Compatibility')
      ? knowledgeBase
      : loadKnowledgeBase();

    const systemPrompt = roofingRules;

    const userPrompt = `Validate that the selected materials are compatible with the detected structures.

STRUCTURES:
${structureSummary}

SELECTED ITEMS:
${itemNames}

Apply the roofing rules above. Check:
1. Material compatibility (e.g., Brava on metal = INCOMPATIBLE)
2. Required underlayment type for each roof type
3. Snow retention (fence for metal, guards for tile/shingle)

Return ONLY valid JSON:
{
  "valid": true | false,
  "warnings": [
    {
      "severity": "error" | "warning" | "info",
      "category": "compatibility" | "missing_item" | "pricing" | "measurement" | "completeness",
      "message": "Description",
      "suggestion": "Optional fix",
      "affectedItems": ["item-id-1"]
    }
  ],
  "suggestions": ["suggestion string"],
  "completeness": 0-100
}`;

    const text = await callClaudeAPI(
      [{ role: 'user', content: userPrompt }],
      systemPrompt
    );

    const parsed = parseAIResponse<{
      valid?: boolean;
      warnings?: Array<Omit<AIWarning, 'id' | 'dismissed'>>;
      suggestions?: string[];
      completeness?: number;
    }>(text);

    const warnings: AIWarning[] = (parsed.warnings || []).map((w) => ({
      id: generateWarningId(),
      severity: w.severity || 'warning',
      category: w.category || 'completeness',
      message: w.message || '',
      suggestion: w.suggestion,
      affectedItems: w.affectedItems,
      dismissed: false,
    }));

    return {
      valid: parsed.valid ?? warnings.every((w) => w.severity !== 'error'),
      warnings,
      suggestions: parsed.suggestions || [],
      completeness: Math.min(100, Math.max(0, parsed.completeness ?? 0)),
    };
  } catch (error) {
    console.error('validateMaterialSelection error:', error);
    return {
      valid: false,
      warnings: [
        {
          id: generateWarningId(),
          severity: 'error',
          category: 'completeness',
          message: 'Validation failed. Please try again.',
          dismissed: false,
        },
      ],
      suggestions: [],
      completeness: 0,
    };
  }
}

// -----------------------------------------------------------------------------
// validateEstimateCompleteness
// -----------------------------------------------------------------------------

export async function validateEstimateCompleteness(
  estimate: Estimate,
  _aiContext: AIProjectContext,
  knowledgeBase: string
): Promise<AIValidationResult> {
  try {
    const summary = {
      totalSquares: estimate.measurements?.total_squares ?? 0,
      materialsCount: estimate.byCategory.materials.length,
      laborCount: estimate.byCategory.labor.length,
      equipmentCount: estimate.byCategory.equipment.length,
      accessoriesCount: estimate.byCategory.accessories.length,
      schaferCount: estimate.byCategory.schafer.length,
      totals: estimate.totals,
      finalPrice: estimate.finalPrice,
    };

    const validationRules = knowledgeBase.includes('Required Items Checklist')
      ? knowledgeBase
      : loadKnowledgeBase();

    const systemPrompt = validationRules;

    const userPrompt = `Validate estimate completeness using the validation rules above.

ESTIMATE SUMMARY:
${JSON.stringify(summary, null, 2)}

Check required items, labor/materials ratio, quantities. Return ONLY valid JSON:
{
  "valid": true | false,
  "warnings": [
    {
      "severity": "error" | "warning" | "info",
      "category": "compatibility" | "missing_item" | "pricing" | "measurement" | "completeness",
      "message": "Description",
      "suggestion": "Optional fix",
      "affectedItems": []
    }
  ],
  "suggestions": ["suggestion"],
  "completeness": 0-100
}`;

    const text = await callClaudeAPI(
      [{ role: 'user', content: userPrompt }],
      systemPrompt
    );

    const parsed = parseAIResponse<{
      valid?: boolean;
      warnings?: Array<Omit<AIWarning, 'id' | 'dismissed'>>;
      suggestions?: string[];
      completeness?: number;
    }>(text);

    const warnings: AIWarning[] = (parsed.warnings || []).map((w) => ({
      id: generateWarningId(),
      severity: w.severity || 'warning',
      category: w.category || 'completeness',
      message: w.message || '',
      suggestion: w.suggestion,
      affectedItems: w.affectedItems,
      dismissed: false,
    }));

    return {
      valid: parsed.valid ?? false,
      warnings,
      suggestions: parsed.suggestions || [],
      completeness: Math.min(100, Math.max(0, parsed.completeness ?? 0)),
    };
  } catch (error) {
    console.error('validateEstimateCompleteness error:', error);
    return {
      valid: false,
      warnings: [
        {
          id: generateWarningId(),
          severity: 'error',
          category: 'completeness',
          message: 'Completeness validation failed. Please try again.',
          dismissed: false,
        },
      ],
      suggestions: [],
      completeness: 0,
    };
  }
}

// -----------------------------------------------------------------------------
// generatePreflightCheck
// -----------------------------------------------------------------------------

export async function generatePreflightCheck(
  estimate: Estimate,
  aiContext: AIProjectContext,
  knowledgeBase: string
): Promise<{
  ready: boolean;
  warnings: AIWarning[];
  introLetterSuggestions: string;
}> {
  const result = await validateEstimateCompleteness(estimate, aiContext, knowledgeBase);

  const hasBlockingErrors = result.warnings.some((w) => w.severity === 'error');
  const ready = result.valid && result.completeness >= 80 && !hasBlockingErrors;

  // Build intro letter suggestions from structures
  const structureLines = aiContext.structures.map(
    (s) => `• ${s.name} (${s.measurements.total_squares.toFixed(1)} sq) - ${s.type}`
  );
  const introLetterSuggestions =
    structureLines.length > 0
      ? `Mention all ${aiContext.structureCount} structures: ${structureLines.join('; ')}`
      : '';

  return {
    ready,
    warnings: result.warnings,
    introLetterSuggestions,
  };
}
