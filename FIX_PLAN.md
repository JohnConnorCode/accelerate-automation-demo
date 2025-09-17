# HOLISTIC FIX PLAN - ACCELERATE Content Automation

## Principles:
1. **NEVER break working functionality**
2. **Test BEFORE and AFTER every change**
3. **Fix root causes, not symptoms**
4. **One module completely before moving to next**

---

## PHASE 1: ESTABLISH BASELINE (30 minutes)

### Goal: Know exactly what works right now

#### Steps:
1. Start fresh server
   ```bash
   lsof -ti:3000 -ti:3001 | xargs kill -9 2>/dev/null
   npm run dev
   ```

2. Test current state
   ```bash
   # Test API
   curl http://localhost:3000/api/health
   
   # Test pipeline
   curl -X POST http://localhost:3000/api/scheduler/run -d '{"task":"content-fetch"}'
   
   # Record results
   ```

3. Document baseline metrics
   - Fetched: X items
   - Validated: X items
   - Inserted: X items
   - Errors: [list]
   - Duration: X seconds

4. Save working state
   ```bash
   git add -A
   git commit -m "BASELINE: Current working state before fixes"
   ```

#### Success Criteria:
- [ ] Know exact pipeline success rate
- [ ] Have baseline to compare against
- [ ] Can rollback if needed

---

## PHASE 2: ENVIRONMENT & CREDENTIALS (1 hour)

### Goal: Single source of truth for configuration

#### Steps:
1. Create proper .env.local
   ```bash
   cp .env.template .env.local
   # Add REAL credentials:
   # - Supabase URL, keys
   # - OpenAI key (if available)
   ```

2. Test connection
   ```typescript
   // Create test script: scripts/test-connection.ts
   import { supabase } from '../src/lib/supabase-client';
   
   async function test() {
     const { data, error } = await supabase
       .from('projects')
       .select('count')
       .limit(1);
     
     console.log('Connection:', error ? 'FAILED' : 'SUCCESS');
   }
   ```

3. Remove other env files
   ```bash
   # Backup first
   tar -czf env-backup.tar.gz .env*
   
   # Keep only needed
   rm -f .env.production .env.vercel .env.openai
   # Keep: .env.local, .env.template, .env.example.clean
   ```

4. Update all services to use centralized client
   - Use ONLY src/lib/supabase-client.ts
   - Remove duplicate createClient() calls
   - Test each service after update

#### Success Criteria:
- [ ] Database connection confirmed
- [ ] Single .env.local file
- [ ] No hardcoded credentials
- [ ] Pipeline still works

---

## PHASE 3: FIX TYPESCRIPT SYSTEMATICALLY (4 hours)

### Goal: Zero TypeScript errors in core modules

#### Order of fixing (MUST be in this order):
1. **src/types/** - Foundation types first
2. **src/lib/** - Shared libraries
3. **src/services/** - Core services
4. **src/core/** - Orchestrator
5. **src/api/** - API routes

#### For EACH module:
```bash
# 1. Check current errors
npm run typecheck 2>&1 | grep "src/types" | wc -l

# 2. Fix ALL errors in that module
# Use proper types, not 'any'
# Add interfaces where needed

# 3. Verify zero errors
npm run typecheck -- --project tsconfig.json src/types

# 4. Test functionality
npm run dev
curl -X POST http://localhost:3000/api/scheduler/run

# 5. Commit if working
git add src/types
git commit -m "fix: TypeScript errors in types module"
```

#### Rules:
- NO `as any` unless absolutely necessary
- NO `@ts-ignore`
- Fix the actual type issue
- Test after EVERY file

#### Success Criteria:
- [ ] 0 errors in src/types
- [ ] 0 errors in src/lib
- [ ] 0 errors in src/services
- [ ] 0 errors in src/core
- [ ] 0 errors in src/api
- [ ] Pipeline still works

---

## PHASE 4: DATABASE SCHEMA VERIFICATION (2 hours)

### Goal: Ensure database matches application expectations

#### Steps:
1. Check existing schema
   ```sql
   -- Run in Supabase SQL editor
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public';
   ```

2. Compare with required schema
   - Check scripts/database-migration.sql
   - Note missing tables/columns

3. Run migrations if needed
   ```sql
   -- Run missing CREATE TABLE statements
   -- Run missing CREATE INDEX statements
   -- Do NOT drop existing data
   ```

4. Test all operations
   ```typescript
   // Test each table
   - Insert test record
   - Update test record
   - Delete test record
   - Verify constraints work
   ```

5. Update TypeScript types to match
   ```bash
   # If schema changed, update:
   src/types/supabase.ts
   ```

#### Success Criteria:
- [ ] All required tables exist
- [ ] All constraints in place
- [ ] All indexes created
- [ ] TypeScript types match database
- [ ] Pipeline inserts successfully

---

## PHASE 5: SERVICE CONSOLIDATION (3 hours)

### Goal: Reduce 48 services to ~10 essential ones

#### Essential Services:
1. `supabase-client.ts` - Database connection
2. `staging-service.ts` - Queue insertion
3. `deduplication.ts` - Dedup logic
4. `logger.ts` - Logging
5. `monitoring-service.ts` - Metrics
6. `cache-service.ts` - Caching
7. `ai-scorer.ts` - AI scoring
8. `accelerate-validator.ts` - Validation
9. `scheduler.ts` - Task scheduling
10. `error-handler.ts` - Error management

#### Process:
1. Identify duplicate functionality
2. Merge into single service
3. Update all imports
4. Test thoroughly
5. Delete unused files

#### Success Criteria:
- [ ] ~10 service files
- [ ] No duplicate functionality
- [ ] All imports updated
- [ ] Pipeline still works

---

## PHASE 6: TESTING SUITE (2 hours)

### Goal: Reliable test suite that actually tests functionality

#### Steps:
1. Fix test infrastructure
   ```typescript
   // jest.setup.ts
   - Proper mocks for Supabase
   - Proper polyfills
   - Test database connection
   ```

2. Fix unit tests
   - One test file at a time
   - Mock external dependencies
   - Test actual functionality

3. Add integration tests
   ```typescript
   // Test full pipeline
   - Fetch → Validate → Dedupe → Insert
   - With real data
   - Verify in database
   ```

4. Add E2E test
   ```typescript
   // Complete user journey
   - Start server
   - Run pipeline
   - Check results
   - Approve item
   - Verify in production table
   ```

#### Success Criteria:
- [ ] All unit tests pass
- [ ] Integration tests pass
- [ ] E2E test passes
- [ ] Can run: npm test

---

## PHASE 7: PRODUCTION HARDENING (2 hours)

### Goal: Ready for real production use

#### Steps:
1. Add error recovery
   - Retry logic for API calls
   - Graceful degradation
   - Error logging

2. Add monitoring
   - Health checks
   - Performance metrics
   - Error tracking

3. Security audit
   ```bash
   npm audit fix
   grep -r "secret\|key\|token" src/
   ```

4. Performance optimization
   - Connection pooling
   - Batch operations
   - Caching strategy

5. Documentation
   - Update README
   - API documentation
   - Deployment guide

#### Success Criteria:
- [ ] Handles errors gracefully
- [ ] Monitoring in place
- [ ] No security issues
- [ ] Performance acceptable
- [ ] Well documented

---

## PHASE 8: VALIDATION (1 hour)

### Goal: Prove system is production ready

#### Steps:
1. Run validation script
   ```bash
   npm run validate
   # Should show >90% health
   ```

2. Stress test
   ```bash
   # Run pipeline 20 times
   for i in {1..20}; do
     curl -X POST http://localhost:3000/api/scheduler/run
     sleep 30
   done
   ```

3. Check metrics
   - Success rate >90%
   - No memory leaks
   - No errors
   - Consistent performance

4. Final checklist
   - [ ] TypeScript compiles
   - [ ] All tests pass
   - [ ] No exposed secrets
   - [ ] Database operations work
   - [ ] Can deploy

#### Success Criteria:
- [ ] Validation score >90%
- [ ] 20 successful pipeline runs
- [ ] Ready for production

---

## TESTING PROTOCOL

### Before EVERY change:
1. Note current functionality
2. Run pipeline once
3. Record metrics

### After EVERY change:
1. Compile TypeScript
2. Run pipeline
3. Compare metrics
4. Only proceed if working

### If something breaks:
1. STOP immediately
2. Git diff to see changes
3. Revert if needed
4. Understand why it broke
5. Fix properly

---

## TIME ESTIMATE

- Phase 1: 30 minutes
- Phase 2: 1 hour
- Phase 3: 4 hours
- Phase 4: 2 hours
- Phase 5: 3 hours
- Phase 6: 2 hours
- Phase 7: 2 hours
- Phase 8: 1 hour

**Total: 15.5 hours of focused work**

---

## CRITICAL RULE

**If pipeline success rate drops below baseline at ANY point:**
1. STOP
2. REVERT
3. UNDERSTAND
4. FIX PROPERLY

Never accept degraded functionality.