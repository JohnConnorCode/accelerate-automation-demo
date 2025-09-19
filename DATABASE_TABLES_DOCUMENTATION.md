# DATABASE TABLES DOCUMENTATION
## Accelerate Content Automation - Table Usage & Purpose

**CRITICAL**: This document lists all database tables used by the Accelerate Content Automation support app. These tables are essential for the data fetching, cleaning, and deduplication pipeline that feeds acceleratewith.us.

---

## 🔴 CORE DATA TABLES (Essential - DO NOT DELETE)

### 1. **`content_queue`**
- **Purpose**: Staging area for all fetched content before approval
- **Usage**: Stores raw fetched data from 30+ sources for review
- **Fields**: id, title, description, url, source, type, status, score, metadata, created_at
- **Critical For**: Initial data collection and deduplication
- **Records**: Currently 156+ items

### 2. **`queue_projects`**
- **Purpose**: Staging area specifically for startup/project submissions
- **Usage**: Holds projects pending review before moving to live `projects` table
- **Fields**: Similar to projects table but with review status fields
- **Critical For**: Project approval workflow
- **Records**: Active queue items

### 3. **`projects`**
- **Purpose**: Live/approved projects displayed on main site
- **Usage**: Final destination for approved projects from queue
- **Fields**: Full project details including funding, team, categories, AI scores
- **Critical For**: Main application display
- **Integration**: Main app reads from this table

### 4. **`queue_funding_programs`**
- **Purpose**: Staging for grants/accelerators/funding opportunities
- **Usage**: Holds funding programs pending review
- **Fields**: Program details, amounts, requirements, deadlines
- **Critical For**: Funding opportunity curation

### 5. **`funding_programs`**
- **Purpose**: Live/approved funding opportunities
- **Usage**: Approved funding programs displayed on main site
- **Fields**: Complete funding program information
- **Integration**: Main app displays these opportunities

### 6. **`queue_resources`**
- **Purpose**: Staging for educational content and tools
- **Usage**: Holds resources pending review
- **Fields**: Resource metadata, categories, pricing, difficulty
- **Critical For**: Resource curation pipeline

### 7. **`resources`**
- **Purpose**: Live/approved educational resources
- **Usage**: Approved resources for builders
- **Fields**: Full resource information
- **Integration**: Main app resource section

---

## 🟡 OPERATIONAL TABLES (Important - Used for Performance)

### 8. **`api_cache`**
- **Purpose**: Caches API responses to reduce external calls
- **Usage**: Stores temporary API results with TTL
- **Fields**: cache_key, cache_value, expires_at
- **Impact if Deleted**: Slower performance, more API calls
- **Can Recreate**: Yes, will rebuild automatically

### 9. **`fetch_history`**
- **Purpose**: Tracks all data fetch operations
- **Usage**: Logs what was fetched, when, and results
- **Fields**: source, items_fetched, items_validated, items_inserted, created_at
- **Impact if Deleted**: Loss of historical data, but app continues
- **Records**: Growing with each fetch operation

### 10. **`system_settings`**
- **Purpose**: Stores configuration values
- **Usage**: API keys, thresholds, model settings
- **Fields**: key, value, description, updated_at
- **Critical Settings**: OpenAI model, auto-approve threshold, rate limits
- **Impact if Deleted**: Falls back to defaults

---

## 🟢 MONITORING TABLES (Optional - For Analytics)

### 11. **`error_logs`**
- **Purpose**: Tracks system errors and exceptions
- **Usage**: Debugging and monitoring
- **Fields**: error_type, error_message, stack_trace, timestamp
- **Impact if Deleted**: Loss of error history only

### 12. **`monitoring_metrics`**
- **Purpose**: System performance metrics
- **Usage**: Tracks memory, CPU, response times
- **Impact if Deleted**: Loss of performance history

### 13. **`search_analytics`**
- **Purpose**: Tracks search queries and results
- **Usage**: Understanding user search patterns
- **Impact if Deleted**: Loss of search insights

### 14. **`monitoring_alerts`**
- **Purpose**: Stores system alerts and notifications
- **Usage**: Alert history and resolution tracking
- **Impact if Deleted**: Loss of alert history

### 15. **`rate_limit_violations`**
- **Purpose**: Tracks API rate limit issues
- **Usage**: Security and abuse prevention
- **Impact if Deleted**: Loss of rate limit history

### 16. **`tags`**
- **Purpose**: Categorization system for content
- **Usage**: Tag management across all content types
- **Impact if Deleted**: Loss of tag associations

### 17. **`webhook_endpoints`**
- **Purpose**: Stores webhook configurations
- **Usage**: External integrations
- **Impact if Deleted**: Loss of webhook configs

### 18. **`webhook_deliveries`**
- **Purpose**: Tracks webhook delivery status
- **Usage**: Webhook delivery history
- **Impact if Deleted**: Loss of delivery logs

---

## 📊 DATA FLOW DIAGRAM

```
External Sources (30+)
        ↓
[content_queue] ← Deduplication Check
        ↓
    Review/Score
        ↓
[queue_projects] [queue_funding_programs] [queue_resources]
        ↓                ↓                      ↓
    Approval         Approval              Approval
        ↓                ↓                      ↓
  [projects]    [funding_programs]        [resources]
        ↓                ↓                      ↓
    Main Application (acceleratewith.us)
```

---

## ⚠️ CRITICAL WARNINGS

### NEVER DELETE These Tables:
1. **content_queue** - Breaks entire fetch pipeline
2. **queue_projects** - Breaks project approval workflow
3. **projects** - Main app will have no projects to display
4. **queue_funding_programs** - Breaks funding curation
5. **funding_programs** - Main app will have no funding opportunities
6. **queue_resources** - Breaks resource curation
7. **resources** - Main app will have no resources

### Safe to Clear (but not delete structure):
- api_cache (will rebuild)
- error_logs (just history)
- monitoring_metrics (just metrics)
- search_analytics (just analytics)
- fetch_history (keep recent for dedup)

### Deduplication Dependencies:
The app checks these fields for duplicates:
- URLs in content_queue
- Project names in queue_projects
- Funding program names in queue_funding_programs
- Resource URLs in queue_resources

---

## 🔄 INTEGRATION POINTS WITH MAIN APP

The main acceleratewith.us application reads from:
1. **projects** - Display approved projects
2. **funding_programs** - Display funding opportunities
3. **resources** - Display educational resources

The support app writes to:
1. **content_queue** - Initial fetch storage
2. **queue_* tables** - Pending approval items
3. **projects/funding_programs/resources** - After approval

---

## 📝 MIGRATION NOTES FOR MAIN APP AGENT

When integrating or cleaning up:

1. **Preserve all queue_* tables** - They're the staging area
2. **Preserve all main content tables** (projects, funding_programs, resources)
3. **content_queue is critical** - It's the deduplication checkpoint
4. **fetch_history helps with deduplication** - Keep at least 30 days
5. **api_cache can be cleared** but keep the table structure
6. **Monitoring tables are optional** but useful for debugging

---

## 🚨 CURRENT STATUS

- **Total Tables Used**: 18
- **Critical Tables**: 7 (content + queue tables)
- **Operational Tables**: 3 (cache, history, settings)
- **Optional Tables**: 8 (monitoring, analytics)
- **Current Data Volume**: 156+ items in queue, growing daily

---

*Last Updated: 2025-09-18*
*This document is critical for database maintenance coordination*