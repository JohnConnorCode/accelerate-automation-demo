# 🚨 CRITICAL - VERIFY DIRECTORY BEFORE ANY WORK 🚨

## THIS IS: accelerate-content-automation
## NOT: polyist-builder-connect

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

## Project Context

**Application**: Accelerate Content Automation System
**Purpose**: Automated content discovery and enrichment
**Tech Stack**: 
- Next.js/Vercel serverless functions
- TypeScript
- React frontend
- Supabase backend

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