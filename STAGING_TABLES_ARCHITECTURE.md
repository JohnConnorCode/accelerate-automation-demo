# 🏗️ ACCELERATE CONTENT AUTOMATION - STAGING TABLES ARCHITECTURE

## 📊 NEW ARCHITECTURE: SEPARATE STAGING TABLES

Instead of a single `content_queue` table, we now have **three dedicated staging tables** for unapproved content:

### 📦 STAGING TABLES (Unapproved Content)
1. **`queued_projects`** - Staging for Web3 startup projects
2. **`queued_funding_programs`** - Staging for grants/accelerators/VCs
3. **`queued_resources`** - Staging for tools/courses/communities

### ✅ PRODUCTION TABLES (Approved Content)
1. **`projects`** - Live approved projects
2. **`funding_programs`** - Live approved funding opportunities
3. **`resources`** - Live approved resources

## 🔄 CONTENT FLOW

```
FETCHING → STAGING → REVIEW → PRODUCTION
         ↓         ↓        ↓
   queued_*   pending    projects
              review     funding_programs
                        resources
```

## 📁 KEY FILES CREATED

### 1. Database Schema
- **`create-staging-tables.sql`** - Creates all three staging tables with proper schema

### 2. Services
- **`src/services/staging-service.ts`** - Manages insertion into correct staging tables
- **`src/api/approve-v2.ts`** - Approval workflow for staging → production

## 🎯 STAGING TABLE SCHEMAS

### 1. queued_projects
```sql
- name, description (min 50 chars), url
- launch_date, funding_raised, team_size
- github_url, twitter_url, discord_url
- categories[], project_needs[]
- grant_participation[], traction_metrics
- status: pending_review/approved/rejected
- score, ai_summary, metadata
```

### 2. queued_funding_programs
```sql
- name, organization, description (min 50 chars), url
- funding_type: grant/accelerator/incubator/vc
- min_amount, max_amount, equity_required
- application_deadline, eligibility_criteria[]
- benefits[], mentor_profiles[]
- status: pending_review/approved/rejected
- score, ai_summary, metadata
```

### 3. queued_resources
```sql
- title, description (min 50 chars), url
- resource_type: tool/course/community/infrastructure
- price_type: free/freemium/paid
- provider_name, difficulty_level
- key_benefits[], use_cases[]
- status: pending_review/approved/rejected
- score, ai_summary, metadata
```

## 🚀 IMPLEMENTATION STEPS

### 1. Create Staging Tables
Run `create-staging-tables.sql` in Supabase:
```bash
https://supabase.com/dashboard/project/eqpfvmwmdtsgddpsodsr/sql/new
```

### 2. Update Orchestrator
Replace content_queue insertion with:
```typescript
import { stagingService } from './services/staging-service';

// Instead of inserting to content_queue:
const result = await stagingService.insertToStaging(scoredItems);
console.log(`Inserted: ${result.inserted.projects} projects, 
  ${result.inserted.funding} funding, ${result.inserted.resources} resources`);
```

### 3. Update Approval Workflow
Use the new approval service:
```typescript
import { approvalServiceV2 } from './api/approve-v2';

// Approve a project
await approvalServiceV2.processApproval({
  itemId: 'uuid-here',
  contentType: 'project',
  action: 'approve',
  reviewedBy: 'admin'
});
```

## ✅ BENEFITS OF SEPARATE STAGING TABLES

1. **Type Safety** - Each table has specific fields for its content type
2. **Better Validation** - Constraints specific to each content type
3. **Cleaner Queries** - No need to filter by type
4. **Scalability** - Can optimize each table independently
5. **Clear Separation** - Staging vs production is explicit

## 📊 QUEUE MANAGEMENT

### View Pending Items
```typescript
const pending = await approvalServiceV2.getPendingItems();
console.log(`
  Projects: ${pending.projects.length}
  Funding: ${pending.funding.length}
  Resources: ${pending.resources.length}
  Total: ${pending.total}
`);
```

### Auto-Approve High Quality
```typescript
// Auto-approve items with score >= 80
const result = await approvalServiceV2.autoApprove(80);
```

### Get Queue Stats
```typescript
const stats = await stagingService.getQueueStats();
console.log(`
  Projects - Pending: ${stats.projects.pending}
  Funding - Pending: ${stats.funding.pending}
  Resources - Pending: ${stats.resources.pending}
`);
```

## 🔧 MIGRATION FROM content_queue

If you have existing data in `content_queue`, migrate it:

```sql
-- Migrate projects
INSERT INTO queued_projects (name, description, url, source, score, status, metadata)
SELECT title, description, url, source, score, status, metadata
FROM content_queue 
WHERE type IN ('project', 'projects');

-- Migrate funding
INSERT INTO queued_funding_programs (name, organization, description, url, source, score, status, metadata)
SELECT title, source, description, url, source, score, status, metadata
FROM content_queue 
WHERE type IN ('funding', 'grant');

-- Migrate resources
INSERT INTO queued_resources (title, description, url, source, score, status, metadata)
SELECT title, description, url, source, score, status, metadata
FROM content_queue 
WHERE type IN ('resource', 'resources', 'tool');
```

## 🎯 FINAL ARCHITECTURE

```
SOURCES (30+ Web3 sites)
    ↓
FETCHERS (categorize by type)
    ↓
SCORING (AI + criteria)
    ↓
STAGING TABLES
├── queued_projects (pending review)
├── queued_funding_programs (pending review)
└── queued_resources (pending review)
    ↓
APPROVAL WORKFLOW
    ↓
PRODUCTION TABLES
├── projects (live)
├── funding_programs (live)
└── resources (live)
    ↓
ACCELERATE PLATFORM (public facing)
```

## ✨ ADVANTAGES

- **No single point of failure** - Each content type has its own pipeline
- **Type-specific validation** - Each table enforces its own rules
- **Better performance** - Smaller, focused tables
- **Clearer data model** - Obvious what goes where
- **Easier debugging** - Can trace content through specific tables

---

*This is the proper A-strategy implementation with dedicated staging tables for each content type.*