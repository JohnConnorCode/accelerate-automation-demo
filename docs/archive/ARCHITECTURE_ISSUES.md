# Architecture Issues Report

## Critical Issues (Fix Immediately)

### 1. Security Vulnerabilities
- **13 HIGH severity npm vulnerabilities**
- No environment variable validation
- No input sanitization in API endpoints
- Secrets potentially exposed in logs

### 2. Over-Engineering
- **40+ service files** for basic content automation
- Redundant services (2 backup services, 2 monitoring services)
- 946-line content prioritizer using TensorFlow for simple scoring
- Complex event-driven architecture where simple functions would work

### 3. Performance Problems
- TensorFlow.js loaded but never disposed (memory leak)
- No database connection pooling
- EventEmitters not cleaned up
- Worker processes hanging in tests

### 4. Dependency Bloat (28 dependencies, should be ~10)
Unnecessary dependencies:
- `@tensorflow/tfjs-node` - Simple scoring doesn't need ML
- `puppeteer` - 21MB, likely unused
- `web3` + `ethers` - Why blockchain?
- `socket.io` - Real-time not needed
- `twitter-api-v2` - No Twitter integration visible

### 5. Test Suite Broken
- Mixed Jest/Vitest imports
- 7/7 test suites failing
- Tests take 50+ seconds
- Memory leaks in teardown

## Recommended Architecture (Simple & Robust)

### Core Services Only (5 files max):
1. **fetcher.ts** - Single unified fetcher with rate limiting
2. **scorer.ts** - Simple scoring algorithm (no ML)
3. **storage.ts** - Database operations with pooling
4. **scheduler.ts** - Cron job handling
5. **api.ts** - REST endpoints

### Dependencies to Keep (10 total):
- @supabase/supabase-js
- openai (if AI scoring needed)
- dotenv
- express
- zod (validation)
- node-fetch
- chalk (CLI)
- commander (CLI)
- typescript
- jest (testing)

### Remove These Services:
- All backup services (use Supabase backups)
- All monitoring services (use external monitoring)
- TensorFlow integration
- Blockchain integrations
- Real-time notifications
- Complex event systems

## Estimated Impact
- **Bundle size**: 80% reduction
- **Memory usage**: 60% reduction  
- **Test time**: 90% reduction
- **Code complexity**: 70% reduction
- **Maintenance burden**: 80% reduction