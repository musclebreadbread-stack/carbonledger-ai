# Deployment Guide

Step-by-step guide for deploying CarbonLedger AI to production.

## Prerequisites

- GitHub repository access
- Vercel account (Team plan recommended)
- Supabase account (Pro plan for production)
- Custom domain (optional)

## 1. Supabase Project Setup

### Create Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Choose a region close to your users (Asia Northeast for Korea)
3. Set a strong database password
4. Note down:
   - Project URL (`NEXT_PUBLIC_SUPABASE_URL`)
   - Anon key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`)
   - Service role key (`SUPABASE_SERVICE_ROLE_KEY`)
   - Database connection string (`DATABASE_URL`)

### Run Migrations

```bash
# Install Supabase CLI
npx supabase login

# Link to your project
npx supabase link --project-ref your-project-ref

# Push migrations
npx supabase db push

# (Optional) Seed sample data
npx supabase db seed
```

### Deploy Edge Functions

Three Deno functions in `supabase/functions/` deploy separately from the Next.js
app and are not covered by the Vercel deployment:

```bash
npx supabase secrets set \
  SUPPLIER_PORTAL_TOKEN_SECRET="$(openssl rand -hex 32)" \
  EDGE_CRON_SECRET="$(openssl rand -hex 32)"

npx supabase functions deploy supplier-intake
npx supabase functions deploy supplier-request-reminders
npx supabase functions deploy target-progress-rollup
```

`target-progress-rollup` requires migration `0004`, so run `db push` first. The two
scheduled functions do nothing until `pg_cron` is pointed at them.

Full instructions, including the scheduling SQL, the token scheme and the
`verify_jwt` settings: [Edge Functions](./edge-functions.md).

### Configure Authentication

1. Go to Supabase Dashboard > Authentication > Providers
2. Enable Email/Password provider
3. (Optional) Configure Google OAuth, Microsoft Azure AD
4. Set redirect URLs:
   - `https://your-domain.com/auth/callback`
   - `http://localhost:3000/auth/callback` (development)

## 2. Vercel Deployment

### Connect Repository

1. Go to [vercel.com](https://vercel.com) and import your GitHub repository
2. Select the Next.js framework preset
3. Set build command: `pnpm build`
4. Set output directory: `.next`

### Environment Variables

Add these environment variables in Vercel Dashboard > Settings > Environment Variables:

| Variable | Environment | Value |
|----------|-------------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | All | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | All | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Production, Preview | Service role key |
| `DATABASE_URL` | Production | PostgreSQL connection string |
| `OPENAI_API_KEY` | Production | OpenAI API key (if using AI) |

### Domain Setup

1. Go to Vercel Dashboard > Settings > Domains
2. Add your custom domain
3. Configure DNS:
   - A record: `76.76.21.21`
   - CNAME: `cname.vercel-dns.com`
4. SSL certificate is automatically provisioned

## 3. CI/CD Pipeline

The GitHub Actions workflow (`.github/workflows/ci.yml`) automatically runs:
- Linting (ESLint)
- Type checking (TypeScript)
- Unit tests (Vitest)
- Build verification

On push to `main`, the deployment workflow deploys to Vercel.

## 4. Monitoring Setup

### Vercel Analytics

1. Enable Web Vitals in Vercel Dashboard
2. Add `@vercel/analytics` package (already included)

### Error Tracking

Consider integrating Sentry for production error tracking:

```bash
pnpm add @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

### Database Monitoring

- Use Supabase Dashboard for real-time query monitoring
- Set up alerts for slow queries and connection limits

## 5. Security Checklist

- [ ] All environment variables set correctly
- [ ] RLS policies enabled on all tables
- [ ] Rate limiting configured
- [ ] CORS headers properly set
- [ ] Authentication required for all protected routes
- [ ] Service role key never exposed to client
- [ ] Database backups enabled (Supabase Pro)
- [ ] SSL enforced for all connections
- [ ] `SUPPLIER_PORTAL_TOKEN_SECRET` and `EDGE_CRON_SECRET` set — the Edge
      Functions return `500 not_configured` rather than falling back to a default
- [ ] Rate limiting in front of `supplier-intake`. It is a public endpoint and the
      function itself does **not** throttle; see
      [Edge Functions](./edge-functions.md#what-is-not-implemented)

## 6. Performance Optimization

- Enable Vercel Edge runtime for frequently accessed API routes
  (distinct from the Supabase Edge Functions above)
- Configure CDN caching for static assets
- Use Supabase connection pooling (pgbouncer)
- Enable Next.js Image Optimization

## Rollback Procedure

If a deployment causes issues:

1. Go to Vercel Dashboard > Deployments
2. Find the last working deployment
3. Click "..." > "Promote to Production"
4. Rollback database if needed: `npx supabase db reset`

## Troubleshooting

### Build Fails
- Check environment variables are set
- Verify `pnpm-lock.yaml` is committed
- Review build logs for TypeScript errors

### Database Connection Issues
- Check connection string format
- Verify IP allowlist in Supabase
- Ensure connection pooler is enabled for serverless

### Authentication Not Working
- Verify redirect URLs in Supabase
- Check `NEXT_PUBLIC_SUPABASE_URL` is correct
- Ensure cookies are being set properly
