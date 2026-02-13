# AI Project Manager - Phase Progress

## Overview
Building Full AI Project Manager to replace brittle rules-based multi-structure detection.

## Phase A: Knowledge Base Foundation ✅ (Feb 14, 2026)
**Goal**: Create domain knowledge files for AI to reference

**Completed**:
- `/lib/knowledge/roofing-rules.md` (114 lines)
  - Material compatibility, underlayment requirements
  - Snow retention rules (fence vs guards)
  - Heat tape calculations, nailing specs
  - Equipment costs, pricing sanity ranges

- `/lib/knowledge/multi-structure-rules.md` (125 lines)
  - RoofScope structure detection patterns
  - Structure type identification (metal/tile/shingle/flat)
  - Measurement completeness validation
  - Analysis page matching logic

- `/lib/knowledge/validation-rules.md` (220 lines)
  - Required items checklists by roof type
  - Multi-structure validation rules
  - Vendor quote integration (Schafer priority)
  - Pricing sanity checks, completeness scoring
  - Pre-flight checklist, error vs warning guidelines

**Status**: Complete and ready for AI consumption

## Phase B: Database Schema + TypeScript Types ✅ (Feb 14, 2026)
**Goal**: Add infrastructure for AI context tracking

**Completed**:
- Database migration: `20260214_add_ai_project_context.sql`
  - Table: `ai_project_context` with company-based RLS
  - Columns: estimate_id, company_id, project_summary, structure_count, structures (jsonb), conversation_log, warnings, validation_status
  - Indexes on estimate_id and company_id
  - RLS policies matching company ownership pattern
  - Trigger for updated_at timestamp
  - Applied to Supabase successfully

- TypeScript types in `types/index.ts`:
  - AIDetectedStructure (id, name, type, measurements, hasAnalysisPage, confidence)
  - AIProjectContext (mirrors DB schema)
  - AIMessage (conversation tracking)
  - AIWarning (severity-based validation)
  - AIValidationResult (validation output)
  - Build passing with no errors

**Status**: Complete, database live, types available

## Phase C: Core AI Agent Logic (Next)
**Goal**: Build AI functions that use knowledge base to make decisions

**To Create**:
- `/lib/ai/project-manager.ts` - Core AI logic
  - detectStructures() - Analyze RoofScope, return Structure[]
  - validateMaterialSelection() - Check compatibility
  - validateEstimateCompleteness() - Pre-flight check
  - generatePreflightCheck() - Final validation before PDF
  - loadKnowledgeBase() - Read markdown files
  - callClaudeAPI() - Anthropic API wrapper

- `/app/api/project-manager/route.ts` - API endpoint
  - POST handler with operations: detect-structures, validate-materials, validate-completeness, preflight-check
  - Authentication via Supabase
  - Database persistence

- `/hooks/useProjectManager.ts` - React hook
  - State management for AI context
  - Functions to call API operations
  - Loading/error states

**Status**: Not started

## Phase D: Integration (Future)
- Update useImageExtraction.ts to call AI detection
- Update RoofScopeEstimator.tsx to show AI warnings
- Update useEstimateCalculation.ts for validation
- Update generateProposal.ts for preflight check

## Phase E: UI Components (Future)
- AIContextPanel - Show AI understanding
- WarningAlert - Inline warnings
- PreflightChecklist - Final check before PDF
- StructureOverview - Visual structure display
