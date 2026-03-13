# 232 Partnership — Partner Portal

A partner directory and matchmaking platform for the 2-3-2 Cohesive Strategy Partnership network.

## Setup

1. Copy `.env.local.example` to `.env.local` and fill in your Supabase credentials
2. Run `npm install`
3. Run `npm run dev` to start the development server

## Environment Variables

Get these from your Supabase project under **Settings → API**:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Tech stack

- Next.js 14 (App Router)
- Supabase (database + auth + storage)
- Tailwind CSS
- TypeScript
- Deployed on Vercel
