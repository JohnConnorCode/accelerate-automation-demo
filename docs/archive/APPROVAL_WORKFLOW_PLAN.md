# Content Approval Workflow - Implementation Plan

## 🎯 Goal
Prevent garbage/errors from reaching live tables by implementing a robust approval workflow with quality checks, enrichment, and validation.

## 📊 Current State vs Target State

### Current State ❌
```
Internet → Fetchers → content_queue → ??? → Live Tables (projects/funding/resources)
```
- No approval mechanism
- No quality validation
- No enrichment before approval
- Direct path to live tables (risky!)

### Target State ✅
```
Internet → Fetchers → content_queue → Enrichment → Quality Scoring → Review Dashboard → Approval → Live Tables
                            ↓                                               ↓
                        [Rejected]                                    [Audit Trail]
```

## 🏗️ Implementation Plan

### Phase 1: Review Dashboard (Immediate)
Create a web-based dashboard for reviewing queued content.

**Components:**
1. **Queue Viewer**
   - Display all pending_review items
   - Sort by score, date, source
   - Filter by type (project/funding/resource)
   - Search functionality

2. **Detail View**
   - Full content display
   - Enrichment data overlay
   - Quality score breakdown
   - Similar items detection
   - Red/green flags

3. **Approval Actions**
   - Approve → Move to live table
   - Reject → Mark as rejected with reason
   - Request Enrichment → Send to enrichment pipeline
   - Edit → Manual corrections before approval

4. **Bulk Operations**
   - Select multiple items
   - Bulk approve high-quality items
   - Bulk reject low-quality items
   - Auto-approve rules setup

### Phase 2: Quality Scoring System
Implement automated quality scoring to help prioritize review.

**Scoring Criteria:**
```javascript
{
  // Content Quality (40 points)
  description_length: 10,      // 500+ chars
  has_website: 5,              // Valid URL
  has_social_links: 5,         // Twitter/Discord/etc
  has_github: 10,              // Open source verification
  has_team_info: 10,           // Team members identified
  
  // Validation (30 points)
  website_active: 10,           // URL responds
  social_verified: 10,          // Social accounts exist
  no_duplicates: 10,            // Not already in DB
  
  // Relevance (30 points)
  meets_criteria: 15,           // Matches ACCELERATE_FINAL_CRITERIA
  recent_activity: 10,          // Updated recently
  urgency_score: 5              // Time-sensitive opportunities
}
```

### Phase 3: Enrichment Pipeline
Enhance content BEFORE approval to ensure quality.

**Enrichment Steps:**
1. **Data Enrichment**
   - Fetch missing fields
   - Verify existing data
   - Add social metrics
   - Check team credentials

2. **AI Enhancement**
   - Expand short descriptions
   - Extract structured data
   - Categorize properly
   - Generate summaries

3. **Validation**
   - Cross-reference multiple sources
   - Check for contradictions
   - Verify claims
   - Detect scams/spam

### Phase 4: Approval Workflow
Implement the actual movement of data.

**Workflow States:**
```sql
-- content_queue.status values:
'pending_review'    -- Just fetched, needs review
'enriching'         -- Being enriched
'ready_for_review'  -- Enriched, awaiting approval
'approved'          -- Ready to move to live table
'rejected'          -- Not suitable
'duplicate'         -- Already exists
```

**Movement Logic:**
```typescript
// Approval process
async function approveContent(itemId: string) {
  // 1. Validate item meets all criteria
  // 2. Check for duplicates in live tables
  // 3. Move to appropriate live table
  // 4. Mark as approved in queue
  // 5. Create audit record
}
```

### Phase 5: Live Table Integration
Safely move approved content to production tables.

**Migration Mapping:**
```
content_queue → projects (if type='project')
content_queue → funding_programs (if type='funding')
content_queue → resources (if type='resource')
```

## 🛠️ Technical Implementation

### 1. Database Schema Updates
```sql
-- Add approval fields to content_queue
ALTER TABLE content_queue ADD COLUMN IF NOT EXISTS
  quality_score numeric DEFAULT 0,
  auto_approved boolean DEFAULT false,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamp with time zone,
  rejection_reason text,
  approval_notes text;

-- Create approval_audit table
CREATE TABLE approval_audit (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  content_id uuid REFERENCES content_queue(id),
  action text NOT NULL, -- 'approved', 'rejected', 'edited'
  performed_by uuid REFERENCES auth.users(id),
  performed_at timestamp with time zone DEFAULT now(),
  details jsonb,
  previous_state jsonb,
  new_state jsonb
);
```

### 2. API Endpoints
```typescript
// Review endpoints
GET    /api/queue                 // List pending items
GET    /api/queue/:id            // Get single item with enrichment
POST   /api/queue/:id/approve    // Approve item
POST   /api/queue/:id/reject     // Reject with reason
POST   /api/queue/:id/enrich     // Trigger enrichment
PUT    /api/queue/:id            // Edit item
POST   /api/queue/bulk-action    // Bulk approve/reject

// Quality endpoints  
GET    /api/queue/:id/score      // Get quality score breakdown
GET    /api/queue/:id/similar    // Find similar items
GET    /api/queue/:id/validate   // Run validation checks
```

### 3. Review Dashboard UI
```typescript
// React components structure
<ApprovalDashboard>
  <QueueFilters />
  <QueueList>
    <QueueItem>
      <QualityScore />
      <ContentPreview />
      <QuickActions />
    </QueueItem>
  </QueueList>
  <DetailModal>
    <ContentDetails />
    <EnrichmentData />
    <ValidationResults />
    <ApprovalActions />
  </DetailModal>
</ApprovalDashboard>
```

### 4. Auto-Approval Rules
```typescript
// Configurable auto-approval
const autoApprovalRules = {
  minQualityScore: 80,
  requiredFields: ['description', 'website_url', 'github_url'],
  trustedSources: ['github', 'defillama'],
  mustHaveTeamInfo: true,
  mustPassValidation: true
};
```

## 📋 Implementation Checklist

### Immediate (Today)
- [ ] Create approval dashboard page
- [ ] Add quality scoring to content_queue
- [ ] Implement basic approve/reject functionality
- [ ] Add duplicate detection

### Short-term (This Week)
- [ ] Build enrichment integration
- [ ] Add bulk operations
- [ ] Implement auto-approval rules
- [ ] Create audit trail

### Medium-term (Next Week)
- [ ] AI-powered enhancement
- [ ] Advanced validation rules
- [ ] Performance optimization
- [ ] Analytics dashboard

## 🎯 Success Metrics

1. **Quality Metrics**
   - 0% garbage in live tables
   - 95%+ approval accuracy
   - <5% false rejections

2. **Efficiency Metrics**
   - <2 min average review time
   - 70%+ auto-approval rate for high-quality content
   - 100% enrichment for approved items

3. **Data Metrics**
   - 100% of approved items have complete data
   - 0 duplicates in live tables
   - Full audit trail for all decisions

## 🚀 Quick Start Implementation

Let's start with the most critical piece - the approval dashboard and workflow:

```bash
# 1. Create the dashboard
npm create vite@latest approval-dashboard -- --template react-ts

# 2. Install dependencies
npm install @supabase/supabase-js lucide-react

# 3. Create approval service
touch src/services/approval-service.ts

# 4. Create review components
touch src/components/QueueList.tsx
touch src/components/ApprovalModal.tsx
```

## 📝 Next Actions

1. **Create approval dashboard** (Phase 1)
2. **Implement quality scoring** (Phase 2)
3. **Connect enrichment service** (Phase 3)
4. **Build approval workflow** (Phase 4)
5. **Test with real data** (Phase 5)

This plan ensures that:
- ✅ No garbage reaches live tables
- ✅ All content is enriched and validated
- ✅ You have full control over what gets approved
- ✅ Automated rules handle obvious cases
- ✅ Complete audit trail for compliance
- ✅ Elegant and efficient workflow