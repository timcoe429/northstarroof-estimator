# Project Structure

## Folders

### /app
Next.js App Router pages and layouts
- `page.tsx` - Main entry point, renders RoofScopeEstimator
- `layout.tsx` - Root layout with fonts and global CSS
- `globals.css` - Tailwind CSS imports
- `/api` - API routes (server-side)

### /components
React components
- `RoofScopeEstimator.tsx` - Main estimator app component

### /lib
Utility functions and clients
- `supabase.ts` - Supabase client for database operations

### /types
TypeScript type definitions
- `index.ts` - Shared types for the app

### /docs
Project documentation

## Key Files

| File | Purpose |
|------|---------|
| `package.json` | Dependencies and scripts |
| `tsconfig.json` | TypeScript configuration |
| `tailwind.config.js` | Tailwind CSS configuration |
| `next.config.js` | Next.js configuration |
| `.env.local` | Local environment variables (not in git) |
| `.env.example` | Example environment variables |
