# Quick Start

## First Time Setup

1. Clone the repo
2. Run `npm install`
3. Copy `.env.example` to `.env.local`
4. Fill in your environment variables:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - ANTHROPIC_API_KEY

## Run Locally
```bash
npm run dev
```

Opens at http://localhost:3000

## Test Build
```bash
npm run build
```

Run this before pushing to catch errors.

## Deploy

Just push to GitHub. Vercel auto-deploys from the main branch.

## Environment Variables

Local: `.env.local` file
Production: Vercel dashboard → Settings → Environment Variables
