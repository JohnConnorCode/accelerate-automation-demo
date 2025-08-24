# 🎯 Admin-Editable Criteria System

## Overview
The Accelerate Platform now features a **fully customizable, admin-editable criteria system** that allows dynamic configuration of content collection rules without code changes.

## ✨ Key Features

### 1. **Dynamic Criteria Management**
- All criteria stored in database, not hardcoded
- Real-time updates without deployment
- Version history tracking
- Audit logging for all changes

### 2. **Elegant Admin UI** (`/admin`)
- Visual criteria editor with sliders and controls
- Live validation of scoring weights (must sum to 100%)
- Drag-and-drop priority ordering
- Instant preview of changes

### 3. **Three Content Types**
Each with fully customizable:
- Required fields
- Scoring weights
- Validation rules
- Enrichment priorities

## 🎛️ Customizable Parameters

### Projects (Early-Stage Startups)
```javascript
{
  required_fields: ['title', 'description', 'url', 'team_size', 'launch_date'],
  scoring_weights: {
    recency: 0.30,        // 2024+ launches
    team_size: 0.20,      // Smaller teams preferred
    funding_stage: 0.15,  // Less funding = more early
    validation: 0.15,     // Grants/incubators
    traction: 0.10,       // Users, GitHub stars
    needs: 0.10           // Actively seeking help
  },
  validation_rules: {
    max_team_size: 10,
    max_funding: 500000,
    min_launch_year: 2024,
    exclude_corporate: true
  }
}
```

### Funding Programs
```javascript
{
  scoring_weights: {
    deadline_urgency: 0.30,
    accessibility: 0.20,
    amount_fit: 0.15,
    recent_activity: 0.20,
    benefits: 0.15
  }
}
```

### Resources
```javascript
{
  scoring_weights: {
    price_accessibility: 0.20,
    recency: 0.15,
    credibility: 0.10,
    relevance: 0.10,
    usefulness: 0.30,
    quality: 0.15
  }
}
```

## 📊 Database Schema

### `content_criteria` Table
- `id`: UUID primary key
- `type`: project | funding | resource
- `name`: Display name
- `description`: Detailed description
- `version`: Auto-incrementing version number
- `active`: Boolean (only one active per type)
- `required_fields`: JSONB array
- `scoring_weights`: JSONB object (must sum to 1.0)
- `validation_rules`: JSONB object
- `enrichment_priorities`: JSONB array
- `created_at`, `updated_at`, `updated_by`: Metadata

### `content_criteria_audit` Table
- Complete audit trail of all changes
- Who changed what and when
- Rollback capability

## 🔧 How It Works

### 1. **Criteria Service** (`criteria-service.ts`)
```typescript
// Get active criteria for content type
const criteria = await criteriaService.getCriteria('project');

// Score content using dynamic criteria
const score = await criteriaService.scoreContent(item, 'project');

// Update criteria (admin only)
await criteriaService.updateCriteria('project', updates, userId);
```

### 2. **Admin Interface** (`/admin`)
- Tab-based interface for each content type
- Visual editors for all parameters
- Real-time validation
- Save confirmation with success messages

### 3. **Orchestrator Integration**
- Automatically uses latest criteria
- Dynamic scoring based on admin settings
- No code changes needed for criteria updates

## 🚀 Benefits

1. **No Code Deployment Required**
   - Change criteria instantly
   - Test different scoring strategies
   - Adapt to market changes quickly

2. **Full Transparency**
   - See exactly how content is scored
   - Understand why content passes/fails
   - Track all changes over time

3. **Experimentation**
   - A/B test different criteria
   - Optimize for different goals
   - Learn what works best

4. **Security**
   - Admin-only access
   - Row-level security in database
   - Complete audit trail

## 📝 Usage Instructions

### For Admins:
1. Navigate to `/admin` in the app
2. Select content type tab (Projects/Funding/Resources)
3. Click "Edit Criteria"
4. Adjust parameters:
   - Add/remove required fields
   - Adjust scoring weights with sliders
   - Modify validation rules
   - Reorder enrichment priorities
5. Click "Save Changes"
6. Changes take effect immediately

### For Developers:
```typescript
// Use criteria in your code
import { criteriaService } from './services/criteria-service';

// Get current criteria
const projectCriteria = await criteriaService.getCriteria('project');

// Score content
const score = await criteriaService.scoreContent(myContent, 'project');

// Clear cache if needed
criteriaService.clearCache();
```

## 🔒 Security

- **Row-Level Security**: Only admins can modify criteria
- **Validation**: All changes validated before saving
- **Audit Log**: Complete history of all modifications
- **Version Control**: Each change creates new version
- **Rollback**: Can revert to previous versions if needed

## 📈 Future Enhancements

- [ ] Import/export criteria as JSON
- [ ] Criteria templates library
- [ ] A/B testing framework
- [ ] Performance metrics per criteria version
- [ ] Automated criteria optimization using ML
- [ ] Criteria scheduling (time-based changes)
- [ ] Team collaboration on criteria changes

## ✅ Summary

The admin-editable criteria system makes Accelerate Platform:
- **Flexible**: Adapt to changing needs without code
- **Transparent**: Clear visibility into scoring logic
- **Maintainable**: No hardcoded rules to update
- **Scalable**: Easy to add new content types
- **Professional**: Enterprise-grade configuration management

Admins can now fine-tune content collection to perfectly match their requirements, all through an elegant UI without touching code.