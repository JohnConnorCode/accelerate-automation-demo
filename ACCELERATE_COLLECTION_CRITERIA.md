# 🎯 ACCELERATE CONTENT COLLECTION CRITERIA

## ✅ PROJECTS - WHAT TO COLLECT

### YES - COLLECT THESE PROJECTS:
✅ **Early-stage Web3 startups** (Pre-seed to Series A)
✅ **Projects actively seeking funding** (< $5M raised)
✅ **Projects looking for co-founders or core team**
✅ **Open-source Web3 projects** seeking contributors
✅ **Hackathon winners** ready to scale
✅ **Projects with MVPs** looking for growth
✅ **DAOs forming** and seeking members
✅ **Projects pivoting** to Web3

### SPECIFIC INDICATORS TO LOOK FOR:
- "seeking funding" / "raising seed round"
- "looking for co-founder" / "hiring founding engineer"
- "just launched" / "beta launch" / "MVP ready"
- "apply to join" / "accepting applications"
- GitHub repos with 10-500 stars (emerging, not established)
- Team size < 10 people
- Less than 2 years old
- Active development (commits in last 30 days)

### NO - DON'T COLLECT THESE:
❌ **Established protocols** (Uniswap, Aave, etc.)
❌ **Projects that already raised >$10M**
❌ **Fully launched products** with 10k+ users
❌ **Solo hobbyist projects** with no growth intent
❌ **Abandoned projects** (no activity >6 months)
❌ **Scams/meme coins** without real utility
❌ **Non-Web3 projects**

---

## 💰 FUNDING PROGRAMS - WHAT TO COLLECT

### YES - COLLECT THESE FUNDING OPPORTUNITIES:
✅ **Grants** ($5k - $500k range)
✅ **Accelerator programs** accepting applications
✅ **Incubators** with open cohorts
✅ **Hackathon prizes** > $1000
✅ **Bounty programs** for builders
✅ **DAO treasuries** funding projects
✅ **Ecosystem funds** (Polygon, Arbitrum, etc.)
✅ **Government Web3 grants**

### SPECIFIC CRITERIA:
- **Application deadline** > 7 days away
- **Funding amount** clearly stated or range given
- **Open to new applicants** (not invite-only)
- **Web3/blockchain focused**
- **Clear application process**
- **Legitimate organization** (verifiable)

### PRIORITY INDICATORS:
- "Applications open" / "Now accepting"
- "Deadline: [specific date]"
- "Early-stage" / "Pre-seed" / "Seed" mentioned
- "No equity" for grants
- "Remote" / "Global" eligibility
- Fast decision timeline (< 3 months)

### NO - DON'T COLLECT THESE:
❌ **Expired opportunities** (deadline passed)
❌ **Vague "contact us for funding"** without process
❌ **Traditional VC funds** without open application
❌ **Loans or debt financing**
❌ **Token sales/ICOs**
❌ **"Pay to pitch" scams**
❌ **Grants requiring 51%+ equity**

---

## 📚 RESOURCES - WHAT TO COLLECT

### YES - COLLECT THESE RESOURCES:
✅ **Developer tools** for Web3 building
✅ **Technical tutorials** (Solidity, Rust, etc.)
✅ **Free courses** on blockchain development  
✅ **API/SDK documentation** for major protocols
✅ **Security best practices** guides
✅ **Legal/regulatory** frameworks
✅ **Token economics** templates
✅ **Smart contract templates**
✅ **Community building** guides

### SPECIFIC CRITERIA:
- **Free or freemium** (paid only if <$100)
- **Updated in last 6 months**
- **From credible sources** (known authors/orgs)
- **Actionable** (not just theory)
- **Web3 specific** (not generic coding)
- **English language** (or with translation)

### QUALITY INDICATORS:
- GitHub stars > 50 for tools
- Published by known protocols/companies
- Author has verifiable expertise
- Contains code examples
- Step-by-step instructions
- Active community/support

### NO - DON'T COLLECT THESE:
❌ **Outdated content** (>1 year without updates)
❌ **Paid courses >$500**
❌ **Generic programming** tutorials
❌ **Trading/price analysis** content
❌ **Promotional content** disguised as education
❌ **Low-quality auto-generated** content
❌ **Broken tools** or deprecated libraries

---

## 🎯 SCORING FORMULA FOR ACCELERATE

```typescript
function scoreForAccelerate(item: ContentItem): number {
  let score = 0;
  
  // FUNDING OPPORTUNITIES (Highest Value)
  if (item.type === 'funding') {
    score += 40;
    
    // Deadline urgency
    const daysUntilDeadline = getDaysUntilDeadline(item);
    if (daysUntilDeadline < 30) score += 20;
    if (daysUntilDeadline < 14) score += 10;
    
    // Amount available
    if (item.metadata.max_amount > 100000) score += 15;
    if (item.metadata.max_amount > 500000) score += 10;
    
    // No equity = better for founders
    if (item.metadata.equity_required === false) score += 10;
  }
  
  // PROJECTS SEEKING HELP (Connection Opportunities)
  if (item.type === 'project') {
    // Early stage = more relevant
    if (item.metadata.stage === 'pre-seed') score += 35;
    if (item.metadata.stage === 'seed') score += 30;
    if (item.metadata.stage === 'idea') score += 25;
    
    // Actively seeking
    if (item.metadata.hiring === true) score += 20;
    if (item.metadata.seeking_funding === true) score += 20;
    if (item.metadata.seeking_cofounders === true) score += 25;
    
    // Traction indicators
    if (item.metadata.github_stars > 10 && item.metadata.github_stars < 500) score += 10;
    if (item.metadata.team_size < 5) score += 10;
  }
  
  // RESOURCES (Educational Value)
  if (item.type === 'resource') {
    score += 20;
    
    // Free is better
    if (item.metadata.price === 0) score += 15;
    
    // Quality indicators
    if (item.metadata.github_stars > 100) score += 10;
    if (item.metadata.from_verified_source) score += 10;
    
    // Relevance to builders
    if (item.tags.includes('tutorial')) score += 5;
    if (item.tags.includes('smart-contracts')) score += 10;
    if (item.tags.includes('security')) score += 10;
  }
  
  // RECENCY BOOST (Fresher = Better)
  const hoursSincePost = getHoursSince(item.created_at);
  if (hoursSincePost < 24) score += 15;
  if (hoursSincePost < 6) score += 10;
  if (hoursSincePost < 1) score += 5;
  
  // ENGAGEMENT SIGNALS
  if (item.metadata.engagement_score > 100) score += 5;
  if (item.metadata.engagement_score > 1000) score += 10;
  
  return Math.min(score, 100);
}
```

---

## 🚨 CRITICAL FILTERS TO APPLY

### For Projects:
```sql
WHERE 
  team_size < 20 AND
  (funding_raised IS NULL OR funding_raised < 5000000) AND
  created_at > NOW() - INTERVAL '2 years' AND
  last_activity > NOW() - INTERVAL '30 days' AND
  (status = 'active' OR status = 'beta' OR status = 'building')
```

### For Funding:
```sql
WHERE
  application_deadline > NOW() + INTERVAL '7 days' AND
  (max_amount >= 5000 OR max_amount IS NULL) AND
  status = 'open' AND
  (eligibility LIKE '%early-stage%' OR eligibility LIKE '%pre-seed%' OR eligibility LIKE '%seed%')
```

### For Resources:
```sql
WHERE
  (price = 0 OR price < 100) AND
  updated_at > NOW() - INTERVAL '6 months' AND
  (category IN ('tutorial', 'tool', 'sdk', 'documentation', 'course')) AND
  language = 'en'
```

---

## ✅ VALIDATION CHECKLIST

Before adding ANY content to Accelerate's database, ask:

1. **Does this help an early-stage founder?**
2. **Is this opportunity actually accessible?** (not invite-only)
3. **Is this information timely?** (not expired/outdated)
4. **Is this Web3/blockchain specific?**
5. **Can someone take action on this TODAY?**

If any answer is NO, don't collect it.

---

## 📊 SUCCESS METRICS

Track collection quality:
- **Relevance Rate**: >80% of items match criteria
- **Action Rate**: >20% get user engagement  
- **Freshness**: >60% less than 7 days old
- **Accessibility**: >90% have clear application process
- **False Positive Rate**: <5% irrelevant content

This is our NORTH STAR for content collection.