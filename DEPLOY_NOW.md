# 🚀 DEPLOY NOW - One Command Setup

## Quick Deploy (30 seconds)

```bash
# Run this ONE command:
./scripts/setup-deployment.sh
```

That's it! The script will:
1. ✅ Create GitHub repository
2. ✅ Link to Vercel
3. ✅ Set all secrets
4. ✅ Deploy to production
5. ✅ Configure automated CI/CD

## What Happens Next

After running the script, you'll have:
- **Production URL**: `https://accelerate-content-automation.vercel.app`
- **Daily runs**: Midnight UTC (or your custom schedule)
- **Auto-deploy**: Every push to main branch
- **Manual trigger**: `/api/run` endpoint

## Manual Steps (if needed)

### Option 1: Deploy to existing Vercel project
```bash
vercel --prod
```

### Option 2: Test locally first
```bash
npm run admin:test  # Test connections
npm run admin:run   # Run fetchers
npm run deploy:prod # Deploy when ready
```

### Option 3: Custom schedule
```bash
# Edit .env first
CRON_SCHEDULE=0 */6 * * *  # Every 6 hours

# Then deploy
./scripts/setup-deployment.sh
```

## Verify Deployment

```bash
# Check health
curl https://your-app.vercel.app/api/health

# Manual trigger
curl -X POST https://your-app.vercel.app/api/run

# Check database (in Supabase)
SELECT COUNT(*) FROM projects;
```

## Environment Status

✅ **Supabase**: Connected to Accelerate database
✅ **Schedule**: Daily at midnight (configurable)
✅ **GitHub Actions**: Ready for CI/CD
✅ **Vercel**: Ready to deploy

---

**Ready to go! Just run: `./scripts/setup-deployment.sh`**