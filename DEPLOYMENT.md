# Deployment Guide

## Prerequisites

1. **Supabase Service Key**: Get from your Supabase project settings
2. **OpenAI API Key**: For AI scoring (optional initially)
3. **Vercel Account**: Free tier is sufficient

## Step 1: Initial Setup

```bash
# Clone the repository (or use this one)
cd ~/Desktop/claude-test-2/accelerate-content-automation

# Run setup script
./setup.sh

# Configure environment
cp .env.example .env.local
# Edit .env.local with your credentials
```

## Step 2: Get Supabase Service Key

1. Go to: https://app.supabase.com/project/eqpfvmwmdtsgddpsodsr/settings/api
2. Copy the "service_role" key (starts with `eyJ...`)
3. Add to `.env.local`:
   ```
   SUPABASE_SERVICE_KEY=your-service-role-key-here
   ```

## Step 3: Deploy to Vercel

### Option A: Via CLI
```bash
npx vercel
# Follow prompts:
# - Link to new project
# - Set environment variables from .env.local
# - Deploy
```

### Option B: Via Dashboard
1. Push to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin YOUR_REPO_URL
   git push -u origin main
   ```

2. Go to https://vercel.com/new
3. Import from GitHub
4. Add environment variables:
   - SUPABASE_URL
   - SUPABASE_SERVICE_KEY
   - CRON_SECRET
   - OPENAI_API_KEY (optional)

## Step 4: Verify Deployment

```bash
# Check health
curl https://your-app.vercel.app/api/health

# View admin dashboard
open https://your-app.vercel.app/admin.html
```

## Step 5: Configure Cron Jobs

Cron jobs are automatically configured via `vercel.json`:
- Weekly content fetch: Monday 9 AM UTC
- Daily scoring: 10 AM UTC
- Daily notifications: 11 AM UTC

Verify they're registered:
```bash
vercel crons ls
```

## Manual Testing

### Trigger fetch manually:
```bash
curl -X POST https://your-app.vercel.app/api/cron/fetch-content \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Check queue:
```bash
curl https://your-app.vercel.app/api/admin/queue
```

## Monitoring

1. **Vercel Dashboard**: Function logs and metrics
2. **Admin Dashboard**: `/admin.html` for queue management
3. **Health Check**: `/api/health` endpoint

## Troubleshooting

### Database Connection Issues
- Verify SUPABASE_URL and SUPABASE_SERVICE_KEY
- Check Supabase project is active
- Ensure service key has correct permissions

### Cron Jobs Not Running
- Check `vercel crons ls`
- Verify CRON_SECRET matches in environment
- Check function logs in Vercel dashboard

### TypeScript Compilation Errors
```bash
npm run build
```

## Production Checklist

- [ ] Environment variables configured
- [ ] Database tables created (content_queue, resources, projects, funding_programs)
- [ ] Cron jobs verified
- [ ] Health check passing
- [ ] Admin dashboard accessible
- [ ] Test fetch working

## Support

For issues, check:
1. Vercel function logs
2. Supabase logs
3. Admin dashboard for queue status