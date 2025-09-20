# 🚨 CLAUDE.md - SINGLE SOURCE OF TRUTH FOR DEVELOPMENT

## 🔴 GOLDEN RULE: TEST FIRST, CLAIM LATER
**MANDATORY**: After ANY change, you MUST run actual tests to verify it works
- Run the actual command/script to test
- Open the actual page in a browser test  
- See the actual output
- NEVER say "should now work" - test it and KNOW it works
- NEVER claim success without end-to-end validation

## 📍 DIRECTORY VERIFICATION - ALWAYS FIRST
```bash
pwd  # MUST show: /Users/johnconnor/Desktop/claude-test-2/accelerate-content-automation
```
**THIS IS THE ONLY APP YOU WORK ON - NEVER TOUCH polyist-builder-connect**

---

## ✅ PROVEN DEVELOPMENT STRATEGY (What Works)

### 1. **Start Simple, Add Complexity Gradually**
- Build core functionality first
- Get the pipeline working end-to-end
- Add features incrementally after core is stable
- **Example**: We built fetch → score → queue → approve first, THEN added enrichment

### 2. **Use Public Data Sources First**
- Start with no-API sources (RSS feeds, public endpoints)
- This provides immediate functionality without configuration
- Add API keys later for enhanced data
- **Proven**: 30+ sources work without any API keys

### 3. **Real Data Over Mock Data**
- NEVER use fake/mock data as fallback
- Empty results are better than fake results
- Always query real sources, even if limited
- **Example**: Public HackerNews API > Fake data

### 4. **Test With Real Workflows**
```bash
# MANDATORY testing sequence:
npm run dev                    # Start development
curl /api/scheduler/run        # Trigger fetch
open http://localhost:3002     # Check UI
# Verify data appears in queue
# Test approval workflow
# Check data lands in live tables
```

### 5. **Incremental Deployment**
- Deploy working features immediately
- Don't wait for 100% completion
- 85% functional > 100% broken
- **Proven**: Our 85% deployment is working in production

---

## 🚫 PROHIBITED ACTIONS (Never Do These)

### 1. **NEVER Delete Without Explicit Permission**
- Don't delete "unused" components - they may be used
- Don't remove "redundant" code - it may be intentional
- Don't clean up without asking first
- **Example**: Deleting test files broke our validation suite

### 2. **NEVER Add Unnecessary Abstractions**
```typescript
// ❌ WRONG - Overengineered
export const createAbstractFactoryProvider<T extends BaseInterface>(...) 

// ✅ RIGHT - Simple and clear
export async function fetchData() { ... }
```

### 3. **NEVER Create Standalone HTML Files**
- No test.html files
- No admin.html files  
- No one-off HTML pages
- **EVERYTHING** must be a React component in the app

### 4. **NEVER Work in Wrong Directory**
- Always verify with `pwd` first
- Never assume you're in the right place
- polyist-builder-connect is OFF LIMITS

### 5. **NEVER Use Mock Data in Production**
```typescript
// ❌ WRONG
if (!data) return FAKE_PROJECTS;

// ✅ RIGHT
if (!data) return [];
```

### 6. **NEVER Claim Without Testing**
- Don't say "should work" - test it
- Don't say "probably fixed" - verify it
- Don't say "looks good" - prove it

### 7. **NEVER Over-Optimize Prematurely**
- Bundle size optimization can wait
- Perfect TypeScript types can wait
- 100% test coverage can wait
- **Ship working features first**

---

## 🎯 BEST PRACTICES (Always Do These)

### 1. **Clarity Over Cleverness**
```typescript
// ✅ Clear and obvious
const isEligible = project.launch_date >= '2024' && project.funding < 500000;

// ❌ Clever but unclear
const e = p.ld >= '24' && p.f < 5e5;
```

### 2. **Explicit Over Implicit**
```typescript
// ✅ Explicit types
interface Project {
  name: string;
  funding: number;
  launch_date: string;
}

// ❌ Implicit any
const processProject = (p: any) => { ... }
```

### 3. **Progressive Enhancement**
1. Make it work (basic functionality)
2. Make it right (fix bugs, add validation)
3. Make it fast (optimize performance)
4. **In that order - never reversed**

### 4. **Document Decisions**
```typescript
// DECISION: Using public API without key because it's reliable and free
// ALTERNATIVE: Could use authenticated API but adds complexity
// REASON: Simpler is better for MVP
```

### 5. **Test Real Scenarios**
```bash
# Real user workflow test:
1. User adds API key
2. System fetches data
3. AI scores content
4. User approves items
5. Data appears in production
```

---

## 📊 TESTING REQUIREMENTS

### Mandatory Before ANY Claim of Success:
1. **Build passes**: `npm run build`
2. **Dev runs**: `npm run dev` (no errors)
3. **Data flows**: Fetch → Queue → Approve → Live
4. **UI works**: All pages load, buttons click
5. **Real data**: Actual content appears, not mocks

### Testing Checklist:
```bash
☐ pwd shows correct directory
☐ npm run dev starts without errors
☐ Can trigger manual fetch
☐ Data appears in queue
☐ Can approve/reject items
☐ Approved items go to live tables
☐ No console errors in browser
☐ All routes work (/dashboard, /content-queue, etc.)
```

---

## 🏗️ PROJECT ARCHITECTURE

### Current Working Architecture:
```
Frontend (React) → API Server → Supabase
                ↓
        No-API Sources (30+)
        Public APIs
        RSS Feeds
        Web Scraping
                ↓
        Scoring (AI when available)
                ↓
        Queue (manual review)
                ↓
        Live Tables (approved only)
```

### What's Proven to Work:
- ✅ Vercel deployment with cron jobs
- ✅ Supabase for data persistence
- ✅ Public sources for immediate data
- ✅ Manual approval workflow
- ✅ React SPA with routing

### What to Avoid:
- ❌ Complex microservices (overkill)
- ❌ GraphQL (unnecessary complexity)
- ❌ Server-side rendering (not needed)
- ❌ Multiple databases (Supabase is enough)

---

## 📈 METRICS FOR SUCCESS

### What "Working" Means:
1. **Data Collection**: 300+ items per fetch
2. **Quality**: 80%+ pass ACCELERATE criteria
3. **Performance**: <2s page loads
4. **Reliability**: <1% error rate
5. **Usability**: Admin can approve/reject easily

### Current Status (Verified):
- ✅ 90% functional without API keys
- ✅ 30+ data sources integrated
- ✅ Approval workflow operational
- ✅ Deployed to production
- ⏳ Awaiting API keys for full functionality

---

## 🔄 DEVELOPMENT WORKFLOW

### For Every Task:
1. **Verify Directory**: `pwd` first
2. **Understand Current State**: Read relevant files
3. **Plan Approach**: Simple solution first
4. **Implement**: One feature at a time
5. **Test Locally**: Full workflow test
6. **Commit**: Descriptive message
7. **Deploy**: If tests pass

### Commit Message Format:
```
feat: [what you added]
fix: [what you fixed]
refactor: [what you improved]
docs: [what you documented]
test: [what you tested]
```

---

## 🚨 LESSONS LEARNED (From Failures)

### What Broke Before:
1. **Working in wrong directory** → 2 days lost
2. **Creating HTML test files** → Confusion and mess
3. **Adding fake data** → False positives
4. **Over-abstracting** → Unmaintainable code
5. **Not testing e2e** → Broken in production

### How We Fixed It:
1. **Always check pwd first**
2. **React components only**
3. **Real data or empty**
4. **Simple, clear code**
5. **Test full workflows**

---

## 🚀 DEPLOYMENT STATUS - READY TO ROLL!

### ✅ PRODUCTION DEPLOYMENT
- **URL**: https://accelerate-content-automation.vercel.app
- **Status**: DEPLOYED & OPERATIONAL
- **Last Verified**: Working with 111+ items in queue
- **Performance**: 582 fetched → 228 validated → 111 inserted

### 📦 ENVIRONMENT VARIABLES (Already Configured in Vercel)
```bash
# Core Database (REQUIRED - Already Set)
SUPABASE_URL=https://eqpfvmwmdtsgddpsodsr.supabase.co
SUPABASE_ANON_KEY=[Set in Vercel]
SUPABASE_SERVICE_ROLE_KEY=[Set in Vercel]
DATABASE_URL=[Set in Vercel]

# Optional API Keys (Add when available)
OPENAI_API_KEY          # For AI scoring
GITHUB_TOKEN            # For GitHub trending
NEWS_API_KEY            # For news content
REDDIT_CLIENT_ID        # For Reddit content
REDDIT_CLIENT_SECRET    # For Reddit content
```

### 🔧 LOCAL DEVELOPMENT
```bash
# Frontend runs on: http://localhost:3001
npm run dev

# API server runs on: http://localhost:3002
npm run server

# Trigger content fetch manually:
curl -X POST http://localhost:3002/api/scheduler/run \
  -H "Content-Type: application/json" \
  -d '{"task": "content-fetch"}'
```

### 📊 CURRENT SYSTEM METRICS
- **Data Sources**: 30+ working without API keys
- **Fetch Success**: 97 items per run average
- **Validation Rate**: 40% pass ACCELERATE criteria
- **Deduplication**: 50% unique after filtering
- **Insertion Success**: 97%
- **Approval Workflow**: Fully operational

### 🎯 CURRENT STATUS

#### ✅ COMPLETED & WORKING:
1. Data pipeline (fetch → validate → dedupe → insert)
2. Deduplication service with URL/title matching
3. Approval UI connected to backend
4. Vercel API endpoints (approve, search, monitoring)
5. Production deployment with env variables
6. Manual approval workflow
7. Content queue with 111+ items

#### 🔴 KNOWN ISSUES:
- None critical - system is operational

#### ⏳ PENDING ENHANCEMENTS:
1. Add optional API keys for enhanced data
2. Implement comprehensive test suite
3. Add Sentry monitoring
4. Optimize bundle size
5. Add rate limiting

---

## 📝 REMEMBER

**This is a BUSINESS TOOL, not a toy project**
- Professional quality matters
- Data integrity is critical
- User experience must be smooth
- Everything must be integrated

**Test everything, assume nothing, verify always**

**When in doubt, choose:**
- Simple over complex
- Working over perfect
- Real over mock
- Integrated over standalone

---

*Last Updated: 2025-09-20*
*Status: READY TO ROLL - 85% functional without API keys, 100% with keys*
*This document is the single source of truth for all development decisions*