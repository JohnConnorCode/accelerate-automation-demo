# ⚡ QUICKSTART - Ready in 5 Minutes!

## 🎯 What You'll Get
A fully automated system that:
- Fetches Web3 opportunities from 20+ sources
- Enriches with social metrics & team verification
- Scores and filters based on strict criteria
- Updates every 6 hours automatically
- Provides API endpoints for integration

## 📋 Prerequisites
- Node.js 18+ installed
- Supabase account (free at [supabase.com](https://supabase.com))
- Vercel account (free at [vercel.com](https://vercel.com))

## 🚀 Setup Steps

### 1. Clone & Install (1 minute)
```bash
git clone [repo-url]
cd accelerate-content-automation
npm install
```

### 2. Create Supabase Project (2 minutes)
1. Go to [app.supabase.com](https://app.supabase.com)
2. Click "New Project"
3. Name it "accelerate-content"
4. Wait for it to provision
5. Go to Settings → API
6. Copy the `URL` and `anon` key

### 3. Configure Environment (30 seconds)
```bash
# Copy the example env file
cp .env .env.local

# Edit .env with your Supabase credentials
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_ANON_KEY=YOUR-ANON-KEY
```

### 4. Setup Database (1 minute)
```bash
# Option A: Use the admin tool
npm run admin:setup
# Follow the instructions to copy SQL to Supabase

# Option B: Manual
# 1. Go to Supabase SQL Editor
# 2. Copy all content from scripts/setup-supabase.sql
# 3. Run it
```

### 5. Test Locally (30 seconds)
```bash
# Check everything is configured
npm run admin:test

# Do a test run (will fetch real data!)
npm run admin:run
```

### 6. Deploy to Vercel (1 minute)
```bash
# Install Vercel CLI if needed
npm i -g vercel

# Deploy (follow prompts)
vercel

# Set environment variables
vercel env add SUPABASE_URL
vercel env add SUPABASE_ANON_KEY

# Deploy to production
vercel --prod
```

## ✅ You're Live!

Your system is now:
- **Live at**: `https://your-app.vercel.app`
- **Health check**: `https://your-app.vercel.app/api/health`
- **Auto-updating**: Every 6 hours via cron

## 📊 Check Your Data

### In Supabase:
```sql
-- See what was fetched
SELECT * FROM projects ORDER BY created_at DESC;
SELECT * FROM funding_programs WHERE status = 'open';
SELECT * FROM resources ORDER BY score DESC;
```

### Via API:
```bash
# Check status
curl https://your-app.vercel.app/api/status

# Check health
curl https://your-app.vercel.app/api/health
```

## 🔧 Optional Enhancements

### Add GitHub for Team Verification (FREE)
```bash
# Get token from: github.com/settings/tokens
vercel env add GITHUB_TOKEN
```

### Add Twitter for Social Metrics ($100/mo)
```bash
# Apply at: developer.twitter.com
vercel env add TWITTER_BEARER_TOKEN
```

### Enable Caching
```bash
vercel env add CACHE_ENABLED true
```

## 🎉 That's It!

You now have a production-ready system that:
- ✅ Fetches from ProductHunt, GitHub, Dev.to, DeFiLlama, and more
- ✅ Stores in Supabase with deduplication
- ✅ Provides REST API endpoints
- ✅ Updates automatically via cron
- ✅ Scales with Vercel's infrastructure

## 📈 Next Steps
1. **Monitor**: Check Vercel logs for cron runs
2. **Customize**: Adjust scoring in `src/lib/accelerate-scorer.ts`
3. **Extend**: Add more fetchers in `src/fetchers/`
4. **Integrate**: Use the API in your frontend

## 🆘 Troubleshooting

### "Supabase not configured"
→ Double-check your SUPABASE_URL and SUPABASE_ANON_KEY

### "No data being fetched"
→ Some APIs need keys. Start with just the free ones (GitHub, Dev.to, DeFiLlama)

### "Cron not running"
→ Check Vercel dashboard → Functions → Crons

---

**Total Setup Time: ~5 minutes**
**Monthly Cost: $0** (using free tiers)
**Coverage: 20-60%** depending on API keys