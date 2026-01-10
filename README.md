# Northstar Roof Estimator

A roofing estimate calculator that extracts measurements from RoofScope images and builds accurate estimates.

## Features

- Paste RoofScope/EagleView screenshots to extract measurements
- Paste price sheets to auto-populate pricing
- Build estimates with materials, labor, equipment, and accessories
- Financial controls: waste %, office overhead %, profit margin %
- Mobile responsive

## Setup

1. Clone this repo
2. Run `npm install`
3. Copy `.env.example` to `.env.local` and add your Supabase credentials
4. Run `npm run dev`

## Tech Stack

- Next.js 14
- Tailwind CSS
- Supabase (database + auth)
- Claude API (image extraction)
