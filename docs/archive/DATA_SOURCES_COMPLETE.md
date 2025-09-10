# 📡 DATA SOURCES - Complete Overview

## 🔄 Currently Active Sources (5)

These are actively fetching data through `simple-orchestrator.ts`:

### 1. **GitHub** 
- **URL**: `https://api.github.com/search/repositories`
- **Query**: `stars:>100 language:typescript sort:updated`
- **Data**: Open-source projects, repositories
- **Method**: REST API
- **Rate Limit**: 30 requests/minute
- **Enrichment**: Contributors, stars, languages, activity

### 2. **HackerNews**
- **URL**: `https://hn.algolia.com/api/v1/search`
- **Query**: `tags=story hitsPerPage=50`
- **Data**: Tech news, discussions, launches
- **Method**: Algolia Search API
- **Rate Limit**: 30 requests/minute
- **Content Type**: Primarily resources and news

### 3. **ProductHunt**
- **URL**: `https://api.producthunt.com/v2/api/graphql`
- **Data**: New product launches, startups
- **Method**: GraphQL API
- **Rate Limit**: 30 requests/minute
- **Content Type**: Projects (startups)
- **Note**: Requires PRODUCTHUNT_TOKEN for full access

### 4. **Dev.to**
- **URL**: `https://dev.to/api/articles`
- **Query**: `per_page=30 tag=webdev,javascript,react`
- **Data**: Developer tutorials, guides
- **Method**: REST API
- **Rate Limit**: 30 requests/minute
- **Content Type**: Resources (educational)

### 5. **DeFiLlama**
- **URL**: `https://api.llama.fi/protocols`
- **Data**: DeFi protocols, TVL data
- **Method**: REST API
- **Rate Limit**: 30 requests/minute
- **Content Type**: Projects and funding data

## 🔍 Enrichment Sources

Used by `enrichmentService` to gather additional data:

### GitHub (Extended)
- **Contributors API**: Team size and members
- **Languages API**: Tech stack
- **Activity API**: Recent commits
- **Stars/Watchers**: Traction metrics

### ProductHunt (Extended)
- **Makers data**: Founder information
- **Votes**: User traction
- **Comments**: Community feedback

### Social Link Extraction
- **Twitter/X**: Extracted from descriptions
- **LinkedIn**: Company and founder profiles
- **Discord**: Community links
- **Telegram**: Group links

### AI Analysis (via Supabase Edge Function)
- **OpenAI GPT**: Comprehensive analysis
- **Summary generation**
- **Strengths/weaknesses analysis**
- **Market fit assessment**
- **Competition analysis**

## 📂 Prepared Fetchers (Not Yet Active)

We have 20+ additional fetchers ready but not integrated:

### Projects
- `github-repos.ts` - Extended GitHub search
- `ecosystem-lists.ts` - Ethereum, Polygon, Solana projects
- `web3-directories.ts` - Web3 project directories
- `early-stage-projects.ts` - Accelerate-specific

### Funding
- `web3-grants.ts` - Grant programs
- `gitcoin.ts` - Gitcoin grants
- `ecosystem-programs.ts` - Ecosystem-specific funding
- `chain-specific.ts` - Chain-specific grants
- `open-funding-opportunities.ts` - Active funding

### Resources
- `github-tools.ts` - Developer tools
- `builder-resources.ts` - Builder-specific resources

### Platforms
- `angellist-wellfound.ts` - Startup data
- `farcaster.ts` - Farcaster posts
- `mirror-xyz.ts` - Mirror articles
- `web3-job-platforms.ts` - Job boards

### Social
- `twitter-x.ts` - Twitter/X API (requires auth)

### Blockchain
- `on-chain-data.ts` - On-chain metrics

### Metrics
- `defi-llama.ts` - Extended DeFi metrics

## 🔄 Data Flow

```
1. FETCH (every 6 hours via cron)
   ↓
2. NORMALIZE (consistent format)
   ↓
3. SCORE (basic scoring 0-100)
   ↓
4. ENRICH (GitHub, social, AI)
   ↓
5. VALIDATE (against criteria)
   ↓
6. DEDUPLICATE (hash + fuzzy match)
   ↓
7. STORE (content_curated table)
```

## 📊 Coverage by Content Type

### Projects (Early-stage startups)
- ✅ GitHub - Open source projects
- ✅ ProductHunt - New launches
- ✅ DeFiLlama - DeFi protocols
- 🔄 AngelList - Ready but not active
- 🔄 Farcaster - Ready but not active

### Funding (Grants, accelerators)
- ⚠️ Limited - Only DeFiLlama indirect data
- 🔄 Gitcoin - Ready but not active
- 🔄 Web3 Grants - Ready but not active
- 🔄 Chain-specific - Ready but not active

### Resources (Tools, guides)
- ✅ Dev.to - Tutorials
- ✅ HackerNews - Tech content
- ✅ GitHub - Tools and libraries
- 🔄 Mirror.xyz - Ready but not active

## 🚀 How to Add More Sources

1. **Update orchestrator sources map**:
```typescript
// In simple-orchestrator.ts
private readonly sources = new Map([
  ['new-source', 'https://api.example.com/endpoint'],
  // ... existing sources
]);
```

2. **Add normalization in fetcher**:
```typescript
// In simple-fetcher.ts normalizeData()
case 'new-source':
  return data.items || [];
```

3. **Configure rate limits if needed**
4. **Add enrichment logic if applicable**

## 📈 Metrics

- **Active Sources**: 5
- **Prepared Sources**: 20+
- **Fetch Frequency**: Every 6 hours
- **Rate Limit**: 30 requests/minute per source
- **Batch Size**: 3 concurrent fetches
- **Timeout**: 10 seconds per request

## 🔑 Required API Keys

Currently configured:
- ✅ GitHub (optional, increases rate limit)
- ✅ OpenAI (via Supabase Edge Function)

Needed for full coverage:
- ⚠️ ProductHunt Token
- ⚠️ Twitter/X API
- ⚠️ Farcaster/Neynar API
- ⚠️ Discord Bot Token

## 📝 Notes

- The system gracefully handles missing API keys
- Rate limiting prevents API bans
- Deduplication prevents duplicate entries
- AI enrichment adds significant value
- Admin can adjust criteria without touching sources