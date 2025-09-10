# 🎯 ACCELERATE PLATFORM - FINAL DATA COLLECTION CRITERIA

## ✅ PROJECTS CRITERIA

### MUST HAVE ALL:
- **Stage**: Early-stage Web3 projects
- **Launch Date**: 2024 or later ONLY
- **Funding**: < $500,000 total raised
- **Team Size**: 1-10 people (prefer 1-5)
- **Independence**: NOT backed by large corporations (no Coinbase, Sony, etc.)

### PREFERRED (Boost Score):
- Participated in grant program/incubator/accelerator
- Evidence of traction (users, partnerships, recognition)
- Active GitHub with recent commits
- Growing community (Discord/Telegram members)

### VERIFICATION REQUIRED:
- ✅ Live project URL (working website)
- ✅ Social media presence (especially Twitter/X)
- ✅ Real, operating project (not vaporware)
- ✅ Recent activity (last 30 days)

### EXCLUDE:
- ❌ Projects launched before 2024
- ❌ Projects with >$500k funding
- ❌ Teams >10 people
- ❌ Corporate-backed projects
- ❌ Abandoned projects (no activity >30 days)
- ❌ Scams/meme coins without utility

---

## 📚 RESOURCES CRITERIA

### MUST PROVIDE:
- Clear value to early-stage Web3 founders
- Actionable content (not just theory)
- Current information (updated in last 6 months)

### ACCEPTED TYPES:
1. **Infrastructure**
   - Developer tools
   - APIs
   - Hosting services
   - Node providers
   - Blockchain infrastructure

2. **Educational**
   - Structured courses
   - Documentation
   - Video tutorials
   - Workshop materials
   - Best practices guides

3. **Tools**
   - Productivity apps
   - Analytics platforms
   - Design tools
   - Collaboration software
   - Development environments
   - Testing frameworks

4. **Communities**
   - Founder collectives
   - Support networks
   - Online groups
   - Mentorship programs
   - Builder DAOs

### ACCESSIBILITY:
- Can be free OR paid
- Must be accessible to early-stage teams
- No enterprise-only tools
- Clear pricing if paid

---

## 💰 FUNDING PROGRAMS CRITERIA

### ACCEPTED TYPES:
1. **Grant Programs**
   - No equity required
   - Clear application process
   - Open to new applicants

2. **Incubators**
   - Structured programs
   - Mentorship included
   - Clear benefits

3. **Accelerators**
   - Defined cohorts
   - Investment terms clear
   - Track record visible

4. **Early-Stage VCs**
   - Invest at pre-seed/seed
   - Web3 focused
   - Active portfolio

### REQUIREMENTS:
- **Currently Active**: Not dormant
- **2025 Activity**: Must show recent investments/grants
- **Verifiable**: Evidence of funded projects
- **Accessible**: Open application process (not invite-only)

### VERIFICATION:
- Recent announcements (last 90 days)
- Portfolio updates
- Social media activity
- Application deadlines current

---

## 📊 DATA COLLECTION REQUIREMENTS

### DETAIL LEVEL:
- **MAXIMUM DETAIL**: Brevity is NOT valued
- Every field should be populated
- Full descriptions (500+ characters preferred)
- Complete metadata
- All available links

### REQUIRED FIELDS FOR PROJECTS:
```typescript
{
  name: string;                    // Full project name
  description: string;              // Detailed description (500+ chars)
  short_description: string;        // Tagline (< 100 chars)
  website_url: string;             // Must be live
  github_url?: string;             // If available
  twitter_url?: string;            // Verification
  discord_url?: string;            // Community size
  
  // Stage Information
  launch_date: string;             // Must be 2024+
  funding_raised: number;          // Must be < 500000
  funding_round?: string;          // pre-seed, seed, etc.
  team_size: number;               // Must be 1-10
  
  // Categories & Tags
  categories: string[];            // DeFi, NFT, Infrastructure, etc.
  supported_chains: string[];      // Ethereum, Polygon, etc.
  project_needs: string[];         // funding, developers, marketing
  
  // Validation
  grant_participation?: string[];  // List of programs
  incubator_participation?: string[];
  traction_metrics?: {
    users?: number;
    tvl?: number;
    transactions?: number;
    github_stars?: number;
  };
  
  // Activity Tracking
  last_activity: string;           // Must be < 30 days
  development_status: string;      // active, beta, launched
  
  // Detailed Context
  problem_solving: string;         // What problem does it solve?
  unique_value_prop: string;       // Why is it different?
  target_market: string;           // Who is it for?
  roadmap_highlights?: string[];   // What's coming next?
}
```

### REQUIRED FIELDS FOR RESOURCES:
```typescript
{
  title: string;                   // Full resource name
  description: string;             // Detailed (500+ chars)
  url: string;                     // Direct link
  
  // Type & Category
  resource_type: string;           // tool, course, community, infrastructure
  category: string;                // specific subcategory
  
  // Accessibility
  price_type: string;              // free, freemium, paid
  price_amount?: number;           // If paid
  trial_available?: boolean;       
  
  // Quality Indicators
  provider_name: string;           // Who created it
  provider_credibility: string;    // Why they're credible
  last_updated: string;            // Must be < 6 months
  
  // Usage Details
  difficulty_level: string;        // beginner, intermediate, advanced
  time_commitment?: string;        // For courses
  prerequisites?: string[];        // What you need to know
  
  // Value Proposition
  key_benefits: string[];          // What you'll gain
  use_cases: string[];             // When to use it
  success_stories?: string[];      // Who's used it successfully
}
```

### REQUIRED FIELDS FOR FUNDING:
```typescript
{
  name: string;                    // Program name
  organization: string;            // Who's offering
  description: string;             // Detailed (500+ chars)
  
  // Funding Details
  funding_type: string;            // grant, accelerator, incubator, vc
  min_amount: number;              
  max_amount: number;
  currency: string;                // USD, ETH, etc.
  equity_required: boolean;        
  equity_percentage?: number;      
  
  // Application Details
  application_url: string;         // Direct link
  application_deadline?: string;   // If applicable
  application_process: string;     // Step-by-step
  decision_timeline: string;       // How long to hear back
  
  // Eligibility
  eligibility_criteria: string[];  // All requirements
  geographic_restrictions?: string[];
  stage_preferences: string[];     // pre-seed, seed, etc.
  sector_focus: string[];          // DeFi, NFT, etc.
  
  // Program Details (if applicable)
  program_duration?: string;       
  program_location?: string;       // Remote, specific city
  cohort_size?: number;           
  
  // Benefits Beyond Funding
  benefits: string[];              // Mentorship, network, etc.
  mentor_profiles?: string[];      // Who are the mentors
  alumni_companies?: string[];     // Success stories
  
  // Activity Verification
  last_investment_date: string;    // Must show 2025 activity
  recent_portfolio: string[];      // Recent investments
  total_deployed_2025: number;     // Capital deployed this year
}
```

---

## 🎯 SCORING ALGORITHM

```typescript
function scoreForAccelerate(item: ContentItem): number {
  let score = 0;
  
  // PROJECTS
  if (item.type === 'project') {
    // Recency (2024+ is mandatory, but newer is better)
    const monthsOld = getMonthsSinceLaunch(item.launch_date);
    if (monthsOld < 3) score += 30;
    else if (monthsOld < 6) score += 20;
    else if (monthsOld < 12) score += 10;
    
    // Team size (smaller is better for early stage)
    if (item.team_size <= 3) score += 20;
    else if (item.team_size <= 5) score += 15;
    else if (item.team_size <= 10) score += 10;
    
    // Funding (less is more early-stage)
    if (item.funding_raised === 0) score += 15;
    else if (item.funding_raised < 100000) score += 10;
    else if (item.funding_raised < 500000) score += 5;
    
    // Validation
    if (item.grant_participation?.length > 0) score += 15;
    if (item.incubator_participation?.length > 0) score += 15;
    if (item.traction_metrics?.users > 100) score += 10;
    if (item.traction_metrics?.github_stars > 50) score += 10;
    
    // Needs (actively seeking help)
    if (item.project_needs?.includes('funding')) score += 10;
    if (item.project_needs?.includes('co-founder')) score += 15;
    if (item.project_needs?.includes('developers')) score += 10;
  }
  
  // FUNDING
  if (item.type === 'funding') {
    // Deadline urgency
    const daysUntilDeadline = getDaysUntilDeadline(item.deadline);
    if (daysUntilDeadline < 30 && daysUntilDeadline > 7) score += 30;
    else if (daysUntilDeadline < 60) score += 20;
    else if (!item.deadline) score += 15; // Rolling basis
    
    // Amount accessibility
    if (item.min_amount <= 10000) score += 15;
    if (item.max_amount >= 100000) score += 10;
    
    // Equity
    if (!item.equity_required) score += 20;
    else if (item.equity_percentage < 7) score += 10;
    
    // Recent activity (2025)
    const daysSinceLastInvestment = getDaysSince(item.last_investment_date);
    if (daysSinceLastInvestment < 30) score += 20;
    else if (daysSinceLastInvestment < 90) score += 10;
    
    // Benefits beyond money
    if (item.benefits?.includes('mentorship')) score += 5;
    if (item.benefits?.includes('network')) score += 5;
  }
  
  // RESOURCES
  if (item.type === 'resource') {
    // Free is better for early stage
    if (item.price_type === 'free') score += 20;
    else if (item.price_type === 'freemium') score += 15;
    else if (item.price_amount < 100) score += 10;
    
    // Recency
    const monthsSinceUpdate = getMonthsSince(item.last_updated);
    if (monthsSinceUpdate < 1) score += 15;
    else if (monthsSinceUpdate < 3) score += 10;
    else if (monthsSinceUpdate < 6) score += 5;
    
    // Credibility
    if (item.provider_credibility?.includes('YC')) score += 10;
    if (item.provider_credibility?.includes('a16z')) score += 10;
    if (item.success_stories?.length > 0) score += 10;
    
    // Relevance
    if (item.category === 'smart-contracts') score += 10;
    if (item.category === 'fundraising') score += 10;
    if (item.difficulty_level === 'beginner') score += 5;
  }
  
  return Math.min(score, 100);
}
```

---

## ✅ VALIDATION CHECKLIST

Before adding to database:

1. **Projects**: Launched 2024+? Under $500k raised? Team ≤10? Independent?
2. **Funding**: Currently active? 2025 activity proven? Clear process?
3. **Resources**: Updated <6 months? Clear value? Accessible?

## 📈 SUCCESS METRICS

- **Project Quality**: 90% meet ALL criteria
- **Funding Relevance**: 100% have 2025 activity
- **Resource Usefulness**: 80% get user engagement
- **Data Completeness**: 95% of fields populated
- **Verification Rate**: 100% have live URLs/social proof