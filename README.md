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
   DATABASE_URL=postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres
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

Check the API runtime setup:

```bash
curl http://localhost:3001/api/health
```

## Deployment

Vercel routes `/api/*` to `api/index.ts` and all other routes to the Vite app. Set `DATABASE_URL` and `JWT_SECRET` in the Vercel project environment before deploying. Local `.env` values are not used by Vercel unless they are added to the project settings.

Use a Supabase pooled connection string for `DATABASE_URL`, then add both values to the Vercel project that owns the production domain:

```bash
vercel env add DATABASE_URL production
vercel env add JWT_SECRET production
vercel --prod
```

After deployment, verify the API configuration without logging in:

```bash
curl https://chameleontech.vercel.app/api/health
```

If `missingEnv` contains `DATABASE_URL` or `JWT_SECRET`, add the missing variable in Vercel and redeploy.
