# 🚀 DEPLOYMENT GUIDE - Accelerate Content Automation

## ⚡ Quick Start (10 Minutes)

### 1️⃣ Clone & Install
```bash
git clone [your-repo]
cd accelerate-content-automation
npm install
```

### 2️⃣ Configure Supabase (3 minutes)
1. Create account at [supabase.com](https://supabase.com)
2. Create new project
3. Go to Settings → API
4. Copy your `URL` and `anon key`
5. Add to `.env`:
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

### 3️⃣ Setup Database (2 minutes)
1. Go to Supabase SQL Editor
2. Copy entire contents of `scripts/setup-supabase.sql`
3. Run the script
4. ✅ Database ready!

### 4️⃣ Test Locally (1 minute)
```bash
# Check setup
npm run admin:setup

# Test connections
npm run admin:test

# Do a test run
npm run admin:run
```

### 5️⃣ Deploy to Vercel (3 minutes)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Follow prompts, then set environment variables:
vercel env add SUPABASE_URL
vercel env add SUPABASE_ANON_KEY

# Deploy to production
vercel --prod
```

## 📊 What You Get

With just Supabase configured, you get:
- ✅ **20% coverage** of Web3 opportunities
- ✅ Automatic fetching from GitHub, Dev.to, Product Hunt, DeFiLlama
- ✅ Scoring and filtering based on strict criteria
- ✅ Database storage with deduplication
- ✅ Health check endpoint
- ✅ Cron job every 6 hours

## 🔑 Optional: Add API Keys for More Coverage

### GitHub (Recommended - FREE)
1. Go to [github.com/settings/tokens/new](https://github.com/settings/tokens/new)
2. Create token with `public_repo` scope
3. Add to Vercel: `vercel env add GITHUB_TOKEN`
4. **Result**: +10% coverage, team verification

### Twitter/X ($100/month)
1. Apply at [developer.twitter.com](https://developer.twitter.com)
2. Get Bearer Token
3. Add to Vercel: `vercel env add TWITTER_BEARER_TOKEN`
4. **Result**: +15% coverage, social validation

### Coverage by Configuration:
- **Base (Supabase only)**: ~20% coverage
- **+ GitHub**: ~30% coverage
- **+ Twitter**: ~45% coverage
- **+ All APIs**: ~60% coverage

## 🎯 API Endpoints

Your deployment provides:

### Health Check
```bash
GET https://your-app.vercel.app/api/health
```

### Status
```bash
GET https://your-app.vercel.app/api/status
```

### Manual Run
```bash
POST https://your-app.vercel.app/api/run
# Optional: ?category=projects|funding|resources

# With auth header:
Authorization: Bearer YOUR_API_SECRET
```

### Automatic Updates
Runs every 6 hours via Vercel Cron

## 📝 Environment Variables Reference

### Required
```env
SUPABASE_URL=              # From Supabase dashboard
SUPABASE_ANON_KEY=         # From Supabase dashboard
```

### Recommended
```env
GITHUB_TOKEN=              # For team verification
CACHE_ENABLED=true         # Enable caching
NODE_ENV=production        # Set for production
```

### Optional (for enhanced features)
```env
TWITTER_BEARER_TOKEN=      # Social metrics
DISCORD_BOT_TOKEN=         # Discord stats
NEYNAR_API_KEY=           # Farcaster data
API_SECRET=               # For manual trigger auth
```

## 🛠️ CLI Commands

### Local Development
```bash
npm run admin:setup       # Setup wizard
npm run admin:test        # Test connections
npm run admin:run         # Run all fetchers
npm run admin:stats       # Show database stats
npm run admin:run projects # Run specific category
```

### Production Monitoring
```bash
# Check health
curl https://your-app.vercel.app/api/health

# Get stats
curl https://your-app.vercel.app/api/status

# Trigger manual run (with auth)
curl -X POST https://your-app.vercel.app/api/run \
  -H "Authorization: Bearer YOUR_SECRET"
```

## 📈 Monitoring

### Vercel Dashboard
- View function logs
- Monitor cron executions
- Check error rates

### Database Monitoring
```sql
-- In Supabase SQL Editor
SELECT * FROM get_content_stats();
SELECT * FROM fetch_history ORDER BY executed_at DESC LIMIT 10;
SELECT * FROM verified_projects;
SELECT * FROM active_funding;
```

## 🚨 Troubleshooting

### "Database not configured"
- Check SUPABASE_URL and SUPABASE_ANON_KEY in Vercel env
- Ensure you ran the SQL setup script

### "No data being fetched"
- Check `/api/health` endpoint
- Look at Vercel function logs
- Verify API keys are set correctly

### "Rate limit errors"
- Normal for free APIs
- System has built-in retry logic
- Consider adding more API keys

### "Cron not running"
- Check Vercel dashboard → Functions → Cron
- Ensure you're on Vercel Pro (for reliable crons)

## 🎉 Success Metrics

After 24 hours, you should see:
- 100+ projects discovered
- 50+ funding opportunities
- 200+ resources indexed
- Automatic updates every 6 hours
- Credibility scores for validation

## 💡 Next Steps

1. **Add more API keys** for better coverage
2. **Set up monitoring** (Sentry, LogRocket)
3. **Create a frontend** to display the data
4. **Add webhook notifications** for new opportunities
5. **Customize scoring** for your specific needs

## 📞 Support

- Check `PRODUCTION_READINESS.md` for detailed info
- Review logs in Vercel dashboard
- Database queries in Supabase SQL editor

---

**Ready to deploy? Just need:**
1. Supabase account (free)
2. Vercel account (free)
3. 10 minutes

That's it! 🚀