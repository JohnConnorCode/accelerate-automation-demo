# 🚀 Vercel Deployment Guide

## Prerequisites
1. Vercel account (https://vercel.com)
2. GitHub repository connected
3. Supabase database with tables created

## Step 1: Install Vercel CLI
```bash
npm i -g vercel
```

## Step 2: Login to Vercel
```bash
vercel login
```

## Step 3: Link Project
```bash
vercel link
```
- Choose "Link to existing project" if you have one
- Or create new project

## Step 4: Set Environment Variables
```bash
# Add each variable
vercel env add SUPABASE_URL
vercel env add SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_KEY
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY
vercel env add CRON_SECRET

# Optional (for enhanced features)
vercel env add OPENAI_API_KEY
vercel env add GITHUB_TOKEN
```

Or add via dashboard: https://vercel.com/[your-team]/[your-project]/settings/environment-variables

### Required Environment Variables:
```
SUPABASE_URL=https://eqpfvmwmdtsgddpsodsr.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_KEY=sbp_6e20e3edb22f4158328b31a0dec746fdd0cbaf2a
VITE_SUPABASE_URL=https://eqpfvmwmdtsgddpsodsr.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
CRON_SECRET=your-secret-key-for-cron-jobs
```

## Step 5: Deploy
```bash
vercel --prod
```

## Step 6: Setup Cron Jobs

Add to `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/scheduler/run",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

This runs every 6 hours. Adjust as needed:
- `"0 * * * *"` - Every hour
- `"0 */6 * * *"` - Every 6 hours  
- `"0 0 * * *"` - Daily at midnight
- `"0 0 * * 1"` - Weekly on Monday

## Step 7: Verify Deployment

1. **Check main site**: https://your-project.vercel.app
2. **Test API endpoints**:
   - `POST /api/approve` - Approval endpoint
   - `POST /api/auto-approve` - Auto-approval
   - `POST /api/scheduler/run` - Manual trigger

3. **Test with curl**:
```bash
# Test scheduler
curl -X POST https://your-project.vercel.app/api/scheduler/run \
  -H "Authorization: Bearer your-cron-secret"

# Test approval
curl -X POST https://your-project.vercel.app/api/approve \
  -H "Content-Type: application/json" \
  -d '{"itemId": "uuid-here", "action": "approve"}'
```

## Troubleshooting

### Build Errors
- Check `npm run build` works locally
- Verify all dependencies in package.json
- Check Node version compatibility

### API Not Working
- Verify environment variables are set
- Check Vercel Functions logs
- Ensure `/api` folder structure is correct

### Database Connection Issues
- Verify Supabase credentials
- Check network/firewall settings
- Ensure tables exist in database

### Frontend Not Loading
- Check build output in Vercel dashboard
- Verify `dist` folder structure
- Check for missing environment variables

## Production Checklist

✅ Database tables created (run SQL script)
✅ Environment variables set in Vercel
✅ GitHub integration enabled
✅ API endpoints deployed
✅ Cron jobs configured
✅ Frontend builds successfully
✅ Approval workflow tested
✅ Auto-approval tested
✅ Data flows to production tables

## Monitoring

1. **Vercel Dashboard**: Check function logs
2. **Supabase Dashboard**: Monitor database
3. **Error Tracking**: Consider adding Sentry
4. **Uptime Monitoring**: Use Vercel Analytics

---

*With this setup, your ACCELERATE system will:*
- Fetch content every 6 hours automatically
- Auto-approve high-quality content (score >= 70)
- Allow manual approval via API
- Store approved content in production tables
- Serve the frontend dashboard

*System is now 100% production-ready!*