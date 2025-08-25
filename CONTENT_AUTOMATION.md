# 🚀 Accelerate Content Automation System

## Overview
This content automation platform fetches real data from the Accelerate platform (www.acceleratewith.us) and generates social media content to drive traffic and engagement.

## ✅ What's Been Built

### 1. **Edge Function: fetch-accelerate-content**
Located at: `supabase/functions/fetch-accelerate-content/`

- Fetches real data from Accelerate database:
  - **Projects**: Latest Web3 projects on the platform
  - **Funding Programs**: Active funding opportunities
  - **Resources**: Educational and development resources
- Generates platform-specific content using OpenAI GPT-4:
  - Twitter threads (3-5 tweets)
  - LinkedIn professional posts
- Saves generated content to `content_queue` table with metadata

### 2. **Dashboard with Content Controls**
Located at: `src/pages/Dashboard.tsx`

- **Three separate buttons** for generating content:
  - 📦 Projects - Fetches latest projects and generates content
  - 💰 Funding - Fetches funding programs and generates content
  - 📚 Resources - Fetches resources and generates content
- Real-time content queue management
- Approve/Reject workflow for generated content
- Platform statistics and analytics

### 3. **Automated Pipeline Service**
Located at: `src/services/automated-pipeline.ts`

Features:
- Scheduled content generation (configurable via cron)
- Auto-publishing for high-scoring content
- Pipeline statistics tracking
- Multiple run modes:
  - `npm run pipeline:start` - Start scheduled pipeline
  - `npm run pipeline:once` - Run once and exit
  - `npm run pipeline:status` - Check pipeline status

### 4. **Integration Tests**
Located at: `src/__tests__/integration/content-automation.test.ts`

- Tests Edge Function endpoints
- Validates content generation
- Verifies database operations
- Tests error handling

## 📊 How It Works

1. **Data Fetching**: The system queries the Accelerate database for the latest:
   - Projects (from `projects` table)
   - Funding Programs (from `funding_programs` table)
   - Resources (from `resources` table)

2. **Content Generation**: Using OpenAI GPT-4, it creates:
   - Engaging social media posts
   - Platform-specific formatting
   - Links back to acceleratewith.us

3. **Queue Management**: Generated content is:
   - Stored in `content_queue` table
   - Scored for quality (0-100)
   - Marked with status (pending/approved/rejected)
   - Linked to source data via metadata

4. **Automation**: The pipeline can:
   - Run on a schedule (every 4 hours by default)
   - Auto-approve high-scoring content
   - Track performance metrics

## 🔧 Configuration

### Environment Variables
```bash
# Required - Already configured
SUPABASE_URL=https://eqpfvmwmdtsgddpsodsr.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...

# Optional - For enhanced functionality
OPENAI_API_KEY=sk-...  # Stored in Supabase secrets
PIPELINE_SCHEDULE=0 */4 * * *  # Cron expression
AUTO_PUBLISH=true  # Auto-approve high-scoring content
MIN_SCORE=80  # Minimum score for auto-publishing
```

### Running the System

#### Development
```bash
# Start frontend dashboard
npm run dev:frontend

# Run pipeline once (test)
npm run pipeline:once

# Start automated pipeline
npm run pipeline:start
```

#### Testing
```bash
# Run integration tests
npm run test:integration

# Test with browser interface
open test-accelerate-fetch.html
```

## 📈 Current Stats (Last 7 Days)
- **604 projects** in Accelerate database
- **Multiple funding programs** available
- **Rich resource library** for builders

## 🎯 Next Steps & Recommendations

1. **Deploy Edge Functions**: Deploy the Edge Functions to Supabase for production use
2. **Add More Platforms**: Extend to Discord, Telegram, Farcaster
3. **Enhanced Analytics**: Track engagement metrics from published content
4. **AI Personalization**: Tailor content to different audience segments
5. **Webhook Integration**: Auto-post to social platforms via APIs
6. **Content Scheduling**: Advanced scheduling with time zone optimization

## 🔐 Security Notes
- OpenAI API key is stored securely in Supabase
- Using shared database with Accelerate platform
- Anon key used for public operations
- Service role key needed for automated operations

## 📝 Maintenance
- Monitor `content_queue` table size
- Review auto-approved content regularly
- Update prompts based on engagement metrics
- Keep dependencies updated

## 🆘 Troubleshooting

### "funding_opportunities table not found"
- The correct table is `funding_programs`
- Edge Function has been updated to use correct table

### "No content generated"
- Check OpenAI API key in Supabase secrets
- Verify data exists in source tables
- Check Edge Function logs in Supabase dashboard

### "Pipeline not running"
- Ensure environment variables are set
- Check cron expression syntax
- Verify Node.js version >= 18

---

**Built for Accelerate Platform** - Automating content to connect Web3 builders with opportunities 🚀