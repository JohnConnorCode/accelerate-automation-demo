# 🚨 CRITICAL - VERIFY DIRECTORY BEFORE ANY WORK 🚨

## THIS IS: accelerate-content-automation (THE AUTOMATION APP)
## NOT: polyist-builder-connect (NEVER TOUCH THIS APP)

## 🔴 ABSOLUTE RULE 🔴
**THIS IS THE ONLY APP YOU WORK ON**
**NEVER EVER TOUCH polyist-builder-connect**

### ⚠️ MANDATORY FIRST COMMAND - NO EXCEPTIONS
```bash
pwd  # MUST show: /Users/johnconnor/Desktop/claude-test-2/accelerate-content-automation
```

If you see ANYTHING else, STOP IMMEDIATELY and navigate to the correct folder.

## 🔴 ABSOLUTE RULES - VIOLATIONS CAUSE CATASTROPHIC FAILURES

1. **ALWAYS run `pwd` FIRST** - Before ANY other command
2. **NEVER assume you're in the right directory** - Check EVERY session
3. **This is a SEPARATE app** from polyist-builder-connect
4. **Working in wrong directory = DESTROYING PRODUCTION**
5. **NO STATIC HTML PAGES** - ALL pages must be React components integrated into the app routes
6. **NEVER create standalone .html files** - Always use React components and routes
7. **THIS IS A BUSINESS TOOL** - Think holistically, integrate everything properly
8. **NO TEST HTML FILES** - Use the React app for ALL testing
9. **FULLY INTEGRATED ONLY** - Every feature must be part of the main app
10. **NO STRAY FILES** - No random test files, everything organized

## Project Context

**Application**: Accelerate Content Automation System
**Purpose**: Professional business tool for automated Web3 opportunity discovery
**Business Process**: 
1. Fetch FROM internet → Enrich → Score → Approve → Live Tables
2. Content types: Projects, Funding Programs, Resources
3. Quality control: Everything reviewed before going live
4. NO garbage in production: Approval required to prevent errors

**Tech Stack**: 
- React + TypeScript + Vite (frontend)
- Supabase (backend database)
- Real APIs only (GitHub, DeFiLlama, CoinGecko, etc.)
- Shadcn/ui components

**Key Requirements**:
- Fully integrated React application
- Professional business tool quality
- Complete approval workflow
- No standalone HTML files ever
- Everything properly routed in App.tsx

## Directory Structure
```
/accelerate-content-automation/
├── api/           # Vercel serverless functions (TypeScript)
├── src/           # React frontend
├── public/        # Static assets
└── vercel.json    # Vercel configuration
```

## Common Mistakes That Have Happened
- ❌ Working in polyist-builder-connect instead of this folder
- ❌ Converting TypeScript to JavaScript (use TypeScript!)
- ❌ Not checking current directory before starting work
- ❌ Creating standalone HTML files (NEVER DO THIS!)
- ❌ Making test HTML files instead of using React app
- ❌ Not integrating features into the main app
- ❌ Treating this like a toy project instead of business tool

## Verification Commands
```bash
# Run ALL of these before starting work:
pwd                              # Must show accelerate-content-automation
git remote -v                    # Must show accelerate repo
ls api/ | head -3               # Should show .ts files, not .js
```

## If You're Ever Unsure
STOP and run:
```bash
pwd && git remote -v && echo "---" && ls -la api/ | head -5
```

This should show accelerate-content-automation paths and TypeScript files.

## REMEMBER
**YOU HAVE ALREADY MADE THIS MISTAKE TWICE**
**IT COST 2 DAYS OF WORK**
**CHECK YOUR DIRECTORY FIRST - ALWAYS**