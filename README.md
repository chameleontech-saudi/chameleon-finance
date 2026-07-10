# Chameleon Finance Dashboard

Partner finance portal for tracking capital inflows, operational expenses, approval status, and treasury balance.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a local environment file:

   ```bash
   cp .env.example .env
   ```

3. Fill in `.env`:

   ```bash
   DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/postgres
   JWT_SECRET=replace-with-a-long-random-secret
   ```

4. Apply the Supabase schema in `supabase/migrations/schema.sql` to the target Supabase project.

5. Start the local app:

   ```bash
   npm run dev
   ```

The Vite app proxies `/api` requests to the Express API on port `3001`.

## Checks

```bash
npm run lint
npm run build
```

## Deployment

Vercel routes `/api/*` to `api/index.ts` and all other routes to the Vite app. Set `DATABASE_URL` and `JWT_SECRET` in the Vercel project environment before deploying.
