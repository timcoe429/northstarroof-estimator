# RoofScopeEstimator.tsx — Structural Reference (Phase 2b Prep)

**Purpose**: Diagnostic map for safe refactoring. DO NOT modify based on this alone — use for planning Phase 2b integration.

---

## 1. Lines 1–50: Imports

```tsx
'use client'

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Upload, DollarSign, Calculator, Settings, ChevronDown, ChevronUp, ChevronRight, AlertCircle, Check, X, Edit2, Plus, Trash2, Package, Users, Truck, Wrench, FileText, Copy, Bot } from 'lucide-react';
import Image from 'next/image';
import type { Measurements, PriceItem, LineItem, CustomerInfo, Estimate, SavedQuote, VendorQuote, VendorQuoteItem, AIDetectedStructure } from '@/types';
import { saveQuote, loadQuotes, loadQuote, deleteQuote, loadPriceItems, savePriceItem, savePriceItemsBulk, deletePriceItemFromDB, saveVendorQuotes, loadVendorQuotes, updateShareSettings } from '@/lib/supabase';
import { generateProposalPDF } from '@/lib/generateProposal';
import { useAuth } from '@/lib/AuthContext';
import { CATEGORIES, UNIT_TYPES, CALC_MAPPINGS, descriptionMap } from '@/lib/constants';
import type { SelectableItem, GroupedVendorItem, CustomItem, QuickSelectOption, ValidationWarning } from '@/types/estimator';
import { fileToBase64, generateId, normalizeVendor, formatVendorName, toNumber, escapeRegExp, removeKeywordFromDescription, formatCurrency, mergeMeasurements } from '@/lib/estimatorUtils';
import { matchSchaferDescription } from '@/lib/schaferMatching';
import { useEstimateCalculation } from '@/hooks/useEstimateCalculation';
import { buildClientViewSections, buildEstimateForClientPdf, copyClientViewToClipboard as copyClientViewToClipboardUtil } from '@/lib/clientViewBuilder';
import { organizeProposal, type OrganizedProposal } from '@/lib/proposalOrganizer';
import { applyAutoSelectionRules } from '@/lib/autoSelectionRules';
import { usePriceItems } from '@/hooks/usePriceItems';
import { useVendorQuotes } from '@/hooks/useVendorQuotes';
import { useImageExtraction } from '@/hooks/useImageExtraction';
import { useSmartSelection } from '@/hooks/useSmartSelection';
import { useSavedQuotes } from '@/hooks/useSavedQuotes';
import { useFinancialControls } from '@/hooks/useFinancialControls';
import { useUIState } from '@/hooks/useUIState';
import { useCustomItems } from '@/hooks/useCustomItems';
import { useProjectManager } from '@/hooks/useProjectManager';
import { PriceListPanel, EstimateBuilder, FinancialSummary, UploadStep, ReviewStep, EstimateView, CalculatedAccessories } from '@/components/estimator';
```

---

## 2. Lines 36–70: useState Declarations

| Line | State Variable | Initial Value |
|------|----------------|---------------|
| 37 | `step` | `'upload'` |
| 38 | `measurements` | `null` |
| 39 | `estimate` | `null` |
| 40 | `isGeneratingPDF` | `false` |
| 41 | `customerInfo` | `{ name: '', address: '', phone: '' }` |
| 42 | `selectedItems` | `[]` |
| 43 | `itemQuantities` | `{}` |
| 44 | `uploadedImages` | `new Set()` |
| 45 | `validationWarnings` | `[]` |
| 46 | `isLoadingQuote` | `false` |
| 47 | `skylightCount` | `0` |
| 48 | `missingAccessoryItems` | `[]` |
| 49 | `savedEstimateId` | `undefined` |
| 50 | `shareToken` | `null` |
| 51 | `shareEnabled` | `false` |
| 52–58 | `sectionHeaders` | `{ materials, labor, equipment, accessories, schafer }` |
| 59 | `manualOverrides` | `{}` |
| 60 | `priceOverrides` | `{}` |
| 61 | `nameOverrides` | `{}` |
| 62 | `organizedProposal` | `null` |
| 63 | `isOrganizing` | `false` |
| 64 | `roofScopeImages` | `[]` |
| 65 | `lastDetection` | `null` (structures, summary, confidence) |
| 66 | `aiStatus` | `null` |

---

## 3. All Hook Calls

### useAuth (line 29)
- **Returns**: `user`, `companyId`, `signOut`
- **Props**: none

### useProjectManager (line 69)
- **Props**: `savedEstimateId ?? null`
- **Returns**: `projectManager` (includes `detectStructures`, `validateMaterials`, `validateCompleteness`, `runPreflightCheck`, `dismissWarning`, `aiContext`, `isLoading`)

### useFinancialControls (line 73)
- **Props**: none
- **Returns**: `marginPercent`, `officeCostPercent`, `wastePercent`, `sundriesPercent`, `salesTaxPercent`, setters for each

### useUIState (line 74)
- **Props**: none
- **Returns**: `showPrices`, `showSavedQuotes`, `showFinancials`, `activeCategory`, `editingItem`, `expandedSections`, `collapsedSections`, `sectionSort`, setters

### useCustomItems (lines 75–79)
- **Props**: `onItemAdded: (itemId, quantity) => { setSelectedItems, setItemQuantities }`
- **Returns**: `customItems`, `customItemDraft`, `startCustomItem`, `cancelCustomItem`, `addCustomItem`, `setCustomItems`, `setCustomItemDraft`

### useVendorQuotes (lines 83–88)
- **Props**: `selectedItems`, `itemQuantities`, `priceItems: []`, `onSetSelectedItems`, `onSetItemQuantities`
- **Returns**: `vendorQuotes`, `vendorQuoteItems`, `vendorQuoteMap`, `vendorItemMap`, `vendorSelectableItems`, `groupedVendorItems`, `vendorAdjustedPriceMap`, `extractVendorQuoteFromPdf`, `setVendorQuotes`, `setVendorQuoteItems`, `handleVendorQuoteUpload`, `removeVendorQuoteFromState`, `isExtractingVendorQuote`, `setShowVendorBreakdown`, `showVendorBreakdown`, `vendorTaxFeesTotal`

### usePriceItems (lines 91–112)
- **Props**: `companyId`, `vendorQuoteItems`, `vendorQuoteMap`, `onSetEditingItem`, `onUpdateVendorItem`, `onDeleteVendorItem`
- **Returns**: `priceItems`, `priceSheetProcessing`, `setExtractedItems`, `extractedItems`, `applyExtractedPrices`, `addPriceItem`, `deletePriceItem`, `updatePriceItem`

### useSmartSelection (lines 144–160)
- **Props**: `measurements`, `vendorQuotes`, `allSelectableItems`, `vendorQuoteItems`, `vendorItemMap`, `itemQuantities`, `isTearOff: false`, `onSetItemQuantities`, `onSetSelectedItems`, `onSetJobDescription`
- **Returns**: `jobDescription`, `setJobDescription`, `quickSelections`, `setQuickSelections`, `smartSelectionReasoning`, `smartSelectionWarnings`, `isGeneratingSelection`, `generateSmartSelection`, `analyzeJobForQuickSelections`, `isTearOff`

### useImageExtraction (lines 272–287)
- **Props**: `measurements`, `uploadedImages`, `onSetMeasurements`, `onSetCustomerInfo`, `onSetUploadedImages`, `onSetStep`, `onSetExtractedItems`, `onSetPriceSheetProcessing`, `onAnalyzeJobForQuickSelections`, `onApplyAutoSelection`, `onExtractVendorQuoteFromPdf`, `onSetVendorQuotes`, `onSetVendorQuoteItems`, `onSetIsExtractingVendorQuote`, `onSetSelectedItems`, `onSetItemQuantities`, `onRoofScopeImageExtracted`
- **Returns**: `isProcessing`, `handleFileUpload`, `handleDrop`, `handlePriceSheetUpload`, `extractFromImage`, `extractPricesFromImage`

### useEstimateCalculation (lines 318–330)
- **Props**: `measurements`, `priceItems`, `allSelectableItems`, `selectedItems`, `itemQuantities`, `marginPercent`, `officeCostPercent`, `wastePercent`, `sundriesPercent`, `salesTaxPercent`, `customerInfo`, `vendorAdjustedPriceMap`, `isTearOff`
- **Returns**: `calculateEstimate`, `calculateItemQuantities`, `validationWarnings` (as `calcValidationWarnings`)

### useSavedQuotes (lines 382–438)
- **Props**: `userId`, `companyId`, `estimate`, `vendorQuotes`, `vendorQuoteItems`, `onSetVendorQuotes`, `onSetVendorQuoteItems`, `onSetMeasurements`, `onSetCustomerInfo`, `onSetJobDescription`, `onSetMarginPercent`, `onSetOfficeCostPercent`, `onSetSundriesPercent`, `onSetWastePercent`, `onSetSalesTaxPercent`, `onSetItemQuantities`, `onSetSelectedItems`, `onSetCustomItems`, `onSetEstimate`, `onSetStep`, `onSetShowVendorBreakdown`, `onAnalyzeJobForQuickSelections`, `onCalculateEstimate`, `onSetIsLoadingQuote`, `jobDescription`
- **Returns**: `savedQuotes`, `isLoadingQuotes`, `fetchSavedQuotes`, `loadSavedQuote`, `saveCurrentQuote`, `deleteSavedQuote`, `isSavingQuote`

---

## 4. Step Rendering Logic

| Step Value | Condition | Rendered Component(s) |
|------------|-----------|------------------------|
| `upload` | `(step === 'upload' \|\| imageExtraction.isProcessing)` | **UploadStep** |
| `extracted` | `step === 'extracted' && measurements` | **ReviewStep**, **EstimateBuilder** (inside "Build Your Estimate" section), **CalculatedAccessories** (as child of EstimateBuilder) |
| `estimate` | `step === 'estimate' && estimate` | **EstimateView** |

**Shared (step-independent)**:
- AI Validation Warnings: `(step === 'extracted' \|\| step === 'estimate') && projectManager.aiContext && warnings.length > 0`
- PriceListPanel: `uiState.showPrices`
- Extracted Items Modal: `priceItems.extractedItems`
- Financial Controls: `uiState.showFinancials`
- AI Status Banner: `aiStatus`

---

## 5. Key Callback Functions

| Line(s) | Function | Description |
|---------|----------|-------------|
| 165–239 | `handleApplyAutoSelection` | Applies auto-selection rules after RoofScope upload; merges auto-selected item IDs and quantities into state |
| 242–265 | `handleRoofScopeImageExtracted` | Runs AI structure detection when RoofScope image is extracted; updates roofScopeImages and lastDetection |
| 340–358 | `triggerOrganization` | Calls organizeProposal; sets organizedProposal; guarded by organizingRef |
| 361–382 | `calculateEstimate` | Calls calculateEstimateHook; preserves section headers and manual overrides; sets estimate, validationWarnings, step; triggers organization |
| 356–418 | `handleUpdateItem` | Updates item name/quantity/price/unit; updates manualOverrides, priceOverrides, nameOverrides; triggers recalculation when needed |
| 421–460 | `handleResetOverride` | Clears manual override for quantity/price/name; restores original values |
| 463–471 | `handleUpdateSectionHeader` | Updates section header for a category; syncs with estimate |
| 505–531 | `buildClientViewSectionsWrapper` | Wraps buildClientViewSections with vendor data and organizedProposal |
| 513–521 | `buildEstimateForClientPdfWrapper` | Wraps buildEstimateForClientPdf |
| 523–531 | `copyClientViewToClipboard` | Copies client view to clipboard |
| 534–552 | `resetEstimator` | Resets all state: step, measurements, estimate, customerInfo, selectedItems, itemQuantities, uploadedImages, roofScopeImages, lastDetection, savedEstimateId, shareToken, shareEnabled, vendor quotes, smart selection |
| 555–576 | `getPriceListItems` | Returns price items for category with section sort applied |
| 578–586 | `getItemQuantity` | Returns quantity for item from itemQuantities or vendorItemMap |
| 588–596 | `toggleSectionSort` | Toggles section sort direction for category/key |
| 598–605 | `getEstimateCategoryItems` | Filters allSelectableItems by category (incl. Schafer) |
| 607–617 | `toggleSection` | Toggles expanded section in expandedSections Set |
| 620–657 | `handleDownloadProposal` | Runs preflight (if saved), builds PDF estimate, generates and downloads PDF |

---

## 6. Props Passed to Child Components

### UploadStep (lines 1192–1200)
- `vendorQuotes` — `vendorQuotes.vendorQuotes`
- `vendorQuoteItems` — `vendorQuotes.vendorQuoteItems`
- `isExtractingVendorQuote` — `vendorQuotes.isExtractingVendorQuote`
- `isProcessing` — `imageExtraction.isProcessing`
- `onFileUpload` — `imageExtraction.handleFileUpload`
- `onDrop` — `imageExtraction.handleDrop`
- `onVendorQuoteUpload` — `vendorQuotes.handleVendorQuoteUpload`
- `onRemoveVendorQuote` — `vendorQuotes.removeVendorQuoteFromState`

### ReviewStep (lines 1310–1346)
- `measurements`, `customerInfo`, `uploadedImages`
- `structureCount` — `structuresForValidation.length`
- `vendorQuotes`, `vendorQuoteItems`, `isExtractingVendorQuote`
- `jobDescription`, `quickSelections`, `smartSelectionReasoning`, `smartSelectionWarnings`, `isGeneratingSelection`
- `allSelectableItemsLength`
- `onCustomerInfoChange` — `(field, value) => setCustomerInfo(...)`
- `onReset` — `resetEstimator`
- `onVendorQuoteUpload`, `onRemoveVendorQuote`
- `onJobDescriptionChange` — `smartSelection.setJobDescription`
- `onToggleQuickSelection` — toggles option, updates jobDescription
- `onGenerateSmartSelection` — `smartSelection.generateSmartSelection`

### EstimateBuilder (lines 1139–1184)
- `allSelectableItems`, `selectedItems`, `itemQuantities`
- `collapsedSections`, `customItemDraft`, `sectionSort`
- `vendorItemMap`, `vendorQuoteMap`
- `missingAccessoryItems`, `sectionHeaders`, `manualOverrides`
- `onUpdateItem` — `handleUpdateItem`
- `onResetOverride` — `handleResetOverride`
- `onUpdateSectionHeader` — `handleUpdateSectionHeader`
- `onToggleSelection`, `onQuantityChange`, `onToggleCollapse`
- `onStartCustomItem`, `onCancelCustomItem`, `onAddCustomItem`, `onUpdateCustomItemDraft`
- `onToggleSectionSort` — `toggleSectionSort`
- `onCalculateEstimate` — `calculateEstimate`
- `getEstimateCategoryItems`
- `calculatedAccessories` — `<CalculatedAccessories ... />` when measurements.eave_length

### CalculatedAccessories (lines 1150–1179, as child of EstimateBuilder)
- `measurements`, `isMetalRoof`, `priceItems`, `selectedItems`
- `onAddToEstimate` — adds material and labor items + quantities
- `skylightCount`, `onAddSkylight`, `onRemoveSkylight`
- `onAddSkylightsToEstimate` — adds skylight item
- `onMissingItemsChange` — `setMissingAccessoryItems`

### EstimateView (lines 1162–1235)
- `estimate`, `estimateId`, `shareToken`, `shareEnabled`
- `validationWarnings`, `isGeneratingPDF`, `isSavingQuote`, `isOrganizing`
- `expandedSections`, `showVendorBreakdown`
- `vendorQuotes`, `vendorQuoteItems`, `vendorItemMap`, `vendorQuoteMap`, `vendorTaxFeesTotal`
- `onDismissWarnings` — `() => setValidationWarnings([])`
- `onDownloadProposal` — `handleDownloadProposal`
- `onToggleSection` — `toggleSection`
- `onToggleVendorBreakdown` — `vendorQuotes.setShowVendorBreakdown`
- `onEditEstimate` — `setStep('extracted')`, clear warnings
- `onSaveQuote` — validation + `savedQuotes.saveCurrentQuote`
- `onUpdateShareSettings` — `updateShareSettings`, set share state
- `onReset` — `resetEstimator`
- `onToggleItemSelection` — deselect item, clear quantity, recalculate

### PriceListPanel (lines 875–886)
- `activeCategory`, `editingItem`, `priceSheetProcessing`
- `onCategoryChange`, `onEditItem`, `onSaveItem`
- `onAddItem`, `onDeleteItem`, `onUpdateItem`
- `onPriceSheetUpload` — `imageExtraction.handlePriceSheetUpload`
- `getPriceListItems`

---

## 7. Step Flow Summary

```
upload ──(imageExtraction)──> extracted ──(calculateEstimate)──> estimate
         UploadStep              ReviewStep + EstimateBuilder       EstimateView
```

**Step transitions**:
- `upload` → `extracted`: via `imageExtraction` (onSetStep)
- `extracted` → `estimate`: via `calculateEstimate` (sets step to 'estimate')
- `estimate` → `extracted`: via `onEditEstimate` (setStep('extracted'))
- Any → `upload`: via `resetEstimator` or `onReset`
