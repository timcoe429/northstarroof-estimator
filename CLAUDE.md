# Northstar Roofing Estimator — Start Here

## Read These Files First
1. `/ai/context.md` — What the project is, tech stack, constraints
2. `/ai/current_plan.md` — What's complete, in progress, next, blockers
3. `/ai/decisions.md` — Why we made certain choices

## CRITICAL RULES — READ BEFORE EVERY TASK

### Track Isolation
- **Track 1 (Single-Building)**: PRODUCTION. Must always work. This is the current app.
- **Track 2 (Multi-Building)**: DEVELOPMENT. Lives on feature branches only. Never merged to main without explicit approval.
- Multi-building code must NEVER modify single-building code paths. It branches off, it doesn't replace.
- When there is 1 building, the app runs the exact same code as today. No `if (buildings.length === 1)` wrappers around existing working logic.

### Commit Rules
- NEVER push changes to more than 3 files in a single commit
- NEVER combine diagnosis and fix in the same task — always audit first, then fix
- Every commit must pass `npm run build`
- Always create a backup branch before major changes: `git branch backup-[description]`
- Work on feature branches for new functionality. Only merge to main after testing.

### Protected Files (Extra Caution Required)
These files are HIGH RISK. Changes require isolated commits and explicit testing:
- `components/RoofScopeEstimator.tsx`
- `components/estimator/EstimateView.tsx`
- `lib/generateProposal.ts`
- `lib/clientViewBuilder.ts`

### Pre-Push Smoke Test Checklist
Before pushing ANY commit, verify:
1. Build step product list visible with items
2. PDF generates with correct kit grouping and pricing
3. Step navigation preserves state (Build → Review → Build doesn't wipe data)
4. Share button is clickable

### If You Break Something
STOP. Do not try to fix forward with more changes. Tell Tim. Let him revert.

### Context File Updates
Every session must end with context file updates. No exceptions.
