# Start Here

Before starting any work, read these files in order:

1. [`/ai/context.md`](ai/context.md) - What this project is
2. [`/ai/current_plan.md`](ai/current_plan.md) - Where we are and what's next
3. [`/ai/decisions.md`](ai/decisions.md) - Why we made certain choices

## Additional Documentation

- [`.cursorrules`](.cursorrules) - Coding standards and development guidelines
- [`docs/PROJECT-STRUCTURE.md`](docs/PROJECT-STRUCTURE.md) - File structure
- [`docs/DATABASE.md`](docs/DATABASE.md) - Database schema
- [`docs/QUICK-START.md`](docs/QUICK-START.md) - Setup instructions
- [`README.md`](README.md) - Project overview

After reading, confirm what phase we're in and what the next task is.

---

# Development Rules

## Working Rules

1. **Plan before executing** — For any change, first explain what you'll do and wait for approval
2. **No silent reverts** — Never revert code without explicitly stating what you're reverting and why
3. **Show don't guess** — When debugging, show actual error messages, don't guess at causes
4. **One change at a time** — Make one logical change, verify it works, then move to the next
5. **Git hygiene** — Commit working states before making risky changes

## File Size Limits

- **No file over 600 lines**
- If a file approaches 500 lines, extract logic before adding more
- Main component was refactored from 4,000 → 824 lines using hooks and component extraction

## Where to Put New Code

### UI Components
- `components/estimator/` - Estimator-specific UI components (9 components extracted)
  - CollapsibleSection, PriceItemRow, ItemRow, FinancialSummary
  - PriceListPanel, EstimateBuilder, UploadStep, ReviewStep, EstimateView
- `components/` - Shared/reusable components

### Business Logic & State Management
- `hooks/` - Custom React hooks (9 hooks created)
  - useFinancialControls - Margin, waste, office, sundries percentages
  - useUIState - UI toggles and visual state
  - useCustomItems - Custom item creation and management
  - usePriceItems - Price list CRUD and bulk operations
  - useVendorQuotes - Vendor quote processing and grouping
  - useImageExtraction - File upload and AI extraction
  - useSmartSelection - Job description and smart item selection
  - useSavedQuotes - Save/load/delete quote functionality
  - useEstimateCalculation - Estimate calculations and validation

### Utilities & Helpers
- `lib/` - Pure functions, calculations, formatters
  - estimatorUtils.ts - General utility functions
  - clientViewBuilder.ts - Client-facing view generation
  - schaferMatching.ts - Schafer description matching
  - constants.ts - App-wide constants
  - generateProposal.ts - PDF generation
- `types/` - TypeScript type definitions
  - estimator.ts - Estimator-specific types

### Data Layer
- `lib/supabase.ts` - All database operations (CRUD functions)
- Keep database logic isolated from UI components

## Refactoring Guidelines

When a component/file gets too large:
1. Extract UI into separate components (see `components/estimator/`)
2. Extract business logic into custom hooks (see `hooks/`)
3. Extract pure functions into utilities (see `lib/`)
4. Keep main component as thin coordinator that wires hooks together

## Code Organization Principles

1. **Separation of Concerns** - UI, logic, data access should be separate
2. **Single Responsibility** - Each file/hook/component does one thing well
3. **Reusability** - Extract shared logic into hooks, shared UI into components
4. **Testability** - Pure functions and isolated hooks are easier to test

## Examples

**Bad** - 4,000 line component with everything inline:
```tsx
export default function RoofScopeEstimator() {
  const [state1, setState1] = useState();
  const [state2, setState2] = useState();
  // ... 50 more useState declarations

  const function1 = () => { /* 100 lines */ };
  const function2 = () => { /* 100 lines */ };
  // ... 30 more functions

  return <div>{/* 1000 lines of JSX */}</div>;
}
```

**Good** - Thin coordinator with hooks and components:
```tsx
export default function RoofScopeEstimator() {
  const financialControls = useFinancialControls();
  const uiState = useUIState();
  const priceItems = usePriceItems({ userId });

  return (
    <>
      <UploadStep {...uploadProps} />
      <ReviewStep {...reviewProps} />
      <EstimateView {...estimateProps} />
    </>
  );
}
```

---

## Architectural Principles

When proposing solutions, always consider maintainability and scalability alongside immediate functionality.

### Before Proposing a Solution, Ask:
- Is there a systemic way to solve this, or is it truly one-off?
- If this needs to happen in multiple places, can it be centralized?
- Will this decision make the codebase easier or harder to maintain?
- Does this create a clear pattern others can follow?
- How does this scale when we add more features?

### Watch Out For:
- Solutions that require manual repetition for each new feature
- Patterns that are easy to forget or get wrong
- Quick fixes that work now but don't scale
- Scattered logic that should be centralized

### Prioritize:
- Clear, obvious patterns that guide developers toward correct usage
- Centralized logic when it makes sense (but not when it doesn't)
- Flexibility when requirements vary by context
- Code organization that makes the right thing easy and the wrong thing hard

### Think in Layers
- Consider both client-side and server-side solutions
- Defense in depth is often better than a single point of control
- Layouts, middleware, and hooks each have their place

### Question the Obvious
The most direct solution isn't always the best solution. Take a moment to consider:
- Is there a structural approach that solves this more elegantly?
- What patterns does the framework provide for this use case?
- How would this look if we had 10x more of these?
