# 📅 CEO Schedule Control Guide

## ✅ What Changed: You're Now in Control

### Before (Problematic):
- **Every 30 minutes** automatic runs (too aggressive!)
- No way to stop it
- No manual control options
- Running while you sleep

### After (CEO-Controlled):
- **Default: Every 24 hours** (sensible default)
- **Manual-Only Mode** available
- **Full control** over timing
- **Run on YOUR schedule**

## 🎮 Your Control Options

### 1. Schedule Modes

#### **Manual-Only Mode** (Recommended for Testing)
```
✅ You decide when to run
✅ Nothing happens automatically
✅ Complete control
✅ No surprises
```

#### **Automatic Mode** (For Production)
```
✅ Runs every 24 hours (default)
✅ Configurable: 1 hour to 1 week
✅ PLUS manual runs anytime
✅ Best of both worlds
```

### 2. How to Control It

#### From Admin Dashboard (`/api/admin?password=accelerate2025`):

**Schedule Control Section** (Big blue box at top):
- **Switch Modes**: Radio buttons for Manual/Automatic
- **Set Interval**: Dropdown from 1 hour to 1 week
- **Run Now Button**: Big green button for instant runs
- **Run with Options**: Choose what to run
- **View History**: See all past runs

#### Quick Access:
```bash
# Manual run from command line
npm run accelerate:update

# Access admin dashboard
open http://localhost:3000/api/admin?password=accelerate2025
```

## 📊 Schedule Configuration

### Default Settings:
```javascript
{
  enabled: true,
  intervalHours: 24,        // ← Changed from 0.5 (30 min) to 24 hours!
  manualOnly: false,        // ← Set to true for manual-only
  autoQualityChecks: true,  // Run quality checks automatically
  autoAIAssessment: true,   // Run AI assessment automatically
  notifyOnComplete: true,   // Get notified when done
  maxItemsPerRun: 500       // Process limit per run
}
```

### Change Interval Options:
- **Every Hour**: For testing
- **Every 6 Hours**: High-activity periods
- **Every 12 Hours**: Twice daily
- **Every 24 Hours**: Daily (DEFAULT) ← Recommended
- **Every 2 Days**: Lower activity
- **Every 3 Days**: Minimal automation
- **Weekly**: Once per week

## 🚀 Manual Run Options

### 1. **Quick Run** (Big Green Button)
```
- Fetches from all sources
- Runs quality checks
- Runs AI assessment
- Shows results immediately
```

### 2. **Run with Options**
```
Choose:
- Skip fetching (just process existing)
- Skip quality checks
- Skip AI assessment
- Specific sources only
```

### 3. **Command Line**
```bash
# Manual run
npm run accelerate:update

# Just projects
npm run orchestrate:projects

# Just funding
npm run orchestrate:funding
```

## 📈 What Happens During a Run

### Automatic Run (every 24 hours):
```
1. Fetch from 20+ sources
2. Deduplicate (85% accuracy)
3. Run quality checks
4. AI assessment (GPT-5)
5. Auto-approve/reject based on scores
6. Send notification
7. Wait 24 hours
```

### Manual Run (when you click):
```
1. Same process as above
2. But happens NOW
3. Shows live progress
4. Returns results immediately
```

## 🔔 Notifications

When a run completes, you get:
- Items processed count
- Approved count
- Rejected count
- Duration
- Any errors

Notifications appear in:
- Admin dashboard activity log
- Database notifications table
- (Optional) Webhook to Slack/Discord

## 💡 Recommended Workflow

### For Testing/Development:
1. Set to **Manual-Only Mode**
2. Run when you want to test
3. Review results
4. Adjust settings
5. Run again

### For Production:
1. Set to **Automatic Mode**
2. Choose **24-hour interval**
3. Let it run daily
4. Check dashboard for results
5. Manual run anytime for urgent updates

## 🛠️ API Endpoints

### Schedule Control:
```javascript
// Get current schedule
GET /api/schedule

// Update schedule
PUT /api/schedule
{
  "intervalHours": 24,
  "manualOnly": false
}

// Trigger manual run
POST /api/schedule
{
  "action": "run_now",
  "options": {
    "skipFetch": false,
    "skipQualityChecks": false,
    "skipAI": false
  }
}
```

## 📊 Database Tables

### New Tables Added:
- `scheduler_history` - Track all runs
- `notifications` - System notifications
- `schedule_analytics` - Performance view

### Settings Stored In:
- `system_settings.schedule_config` - Your configuration

## ⚠️ Important Notes

1. **Default is 24 hours**, not 30 minutes
2. **You can switch to manual-only** anytime
3. **Manual runs work** regardless of schedule
4. **History is tracked** for all runs
5. **No automatic runs** without your permission (if manual-only)

## 🎯 Quick Start

1. Go to admin dashboard
2. Find "Schedule Control" section (blue box)
3. Choose "Manual Only" to start
4. Click "Run Now" when ready
5. Switch to "Automatic" when comfortable

## 🔒 Security

- Schedule changes require admin access
- All runs are logged with timestamp
- Manual vs automatic clearly marked
- Full audit trail in database

---

**Bottom Line**: You now have COMPLETE control over when the system runs. No more aggressive 30-minute cycles. Default is a sensible 24 hours, but you can set it to manual-only and run it whenever YOU want.