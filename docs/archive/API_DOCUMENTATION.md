# Accelerate Content Automation API Documentation

## Base URL
- Production: `https://your-domain.vercel.app/api`
- Development: `http://localhost:3000/api`

## Authentication

### JWT Authentication (Admin endpoints)
All admin endpoints require a valid JWT token from Supabase Auth.

```javascript
headers: {
  'Authorization': 'Bearer YOUR_JWT_TOKEN'
}
```

### Rate Limiting
- Default: 100 requests per minute per IP
- Admin endpoints: 50 requests per minute

## Endpoints

### Health & Status

#### GET /api/health
Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "content-automation-api"
}
```

#### GET /api/status
Get service status and statistics.

**Response:**
```json
{
  "status": "operational",
  "uptime": 3600,
  "stats": {
    "total": 1000,
    "pending": 50,
    "approved": 800,
    "rejected": 150
  }
}
```

### Dashboard & Analytics

#### GET /api/dashboard
Get dashboard data including recent items and statistics.

**Response:**
```json
{
  "stats": {
    "total": 1000,
    "pending": 50,
    "approved": 800,
    "rejected": 150
  },
  "items": [...],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### GET /api/analytics
Get detailed analytics data.

**Query Parameters:**
- `timeframe`: '24h' | '7d' | '30d' | 'all' (default: '7d')

**Response:**
```json
{
  "totalItems": 1000,
  "statusBreakdown": {
    "pending": 50,
    "approved": 800,
    "rejected": 150
  },
  "categoryBreakdown": {
    "resources": 400,
    "projects": 350,
    "funding": 250
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Admin Operations (Protected)

#### POST /api/admin
Execute admin operations (requires JWT authentication).

**Request Body:**
```json
{
  "action": "queue" | "approve" | "reject",
  "items": [...],  // For queue action
  "ids": [...]     // For approve/reject actions
}
```

**Response:**
```json
{
  "success": true,
  "queued": 10,    // For queue action
  "approved": 5,   // For approve action
  "rejected": 3,   // For reject action
  "failed": 0
}
```

### Content Enrichment

#### POST /api/enrich
Enrich content with AI analysis.

**Request Body:**
```json
{
  "id": "content-id",
  "options": {
    "aiAnalysis": true,
    "keywords": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "enriched": true,
  "item": {
    "id": "content-id",
    "enrichment_data": {
      "aiAnalysis": "High quality content relevant to builders",
      "keywords": ["AI", "startup", "innovation"],
      "sentiment": "positive",
      "quality_score": 85
    },
    "enriched_at": "2024-01-01T00:00:00.000Z"
  }
}
```

#### POST /api/ai-assess
Assess content using AI.

**Request Body:**
```json
{
  "content": {
    "title": "Project Title",
    "description": "Project description",
    "url": "https://example.com"
  }
}
```

**Response:**
```json
{
  "success": true,
  "assessment": {
    "score": 8.5,
    "recommendation": "approve",
    "confidence": 0.9,
    "factors": {
      "relevance": 9,
      "quality": 8,
      "urgency": 7
    }
  }
}
```

### Search

#### POST /api/search
Search content database.

**Request Body:**
```json
{
  "query": "blockchain",
  "filters": {
    "status": "approved",
    "category": "projects",
    "minScore": 7
  },
  "limit": 50
}
```

**Response:**
```json
{
  "results": [...],
  "total": 100,
  "page": 1
}
```

### Scheduler (Protected)

#### GET /api/scheduler/status
Get scheduler status and active tasks.

**Response:**
```json
{
  "active": true,
  "tasks": ["content-fetch", "daily-report", "health-check"],
  "count": 3
}
```

#### POST /api/scheduler/run
Manually trigger a scheduled task.

**Request Body:**
```json
{
  "task": "content-fetch" | "daily-report" | "health-check"
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "fetched": 50,
    "scored": 50,
    "stored": 45,
    "rejected": 5
  }
}
```

## Edge Functions

### POST /functions/v1/ai-enrichment
AI enrichment edge function (deployed to Supabase).

**Request Body:**
```json
{
  "content": {
    "title": "Project Title",
    "description": "Description"
  },
  "contentType": "project" | "resource" | "funding"
}
```

**Response:**
```json
{
  "relevance_score": 9,
  "quality_score": 8,
  "urgency_score": 7,
  "team_score": 7,
  "traction_score": 6,
  "ai_summary": "Summary text",
  "ai_reasoning": "Reasoning text",
  "confidence": 0.85
}
```

## Error Responses

All endpoints may return error responses in the following format:

```json
{
  "error": "Error type",
  "message": "Detailed error message"
}
```

### Common HTTP Status Codes
- `200` - Success
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden (admin access required)
- `404` - Not Found
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

## Webhooks

The system can send webhooks for the following events:
- Content approved
- Content rejected
- Daily report generated
- Error occurred

Configure webhook URLs in environment variables:
- `ZAPIER_WEBHOOK_URL`
- `SLACK_WEBHOOK_URL`
- `DISCORD_WEBHOOK_URL`

## Rate Limits

- Public endpoints: 100 requests/minute
- Admin endpoints: 50 requests/minute
- AI endpoints: 20 requests/minute

## SDK Examples

### JavaScript/TypeScript
```typescript
const response = await fetch('https://api.example.com/api/dashboard', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const data = await response.json();
```

### Python
```python
import requests

headers = {
  'Authorization': f'Bearer {token}'
}
response = requests.get('https://api.example.com/api/dashboard', headers=headers)
data = response.json()
```

### cURL
```bash
curl -X GET https://api.example.com/api/dashboard \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Environment Variables

Required environment variables for full functionality:

```env
# Database
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# Authentication
JWT_SECRET=your_jwt_secret

# OpenAI (stored in Supabase Edge Function)
OPENAI_API_KEY=your_openai_key

# Notifications
RESEND_API_KEY=your_resend_key
ADMIN_EMAIL=admin@example.com
SLACK_WEBHOOK_URL=your_slack_webhook
DISCORD_WEBHOOK_URL=your_discord_webhook
ZAPIER_WEBHOOK_URL=your_zapier_webhook

# External APIs (optional)
GITHUB_TOKEN=your_github_token
PRODUCTHUNT_TOKEN=your_producthunt_token
TWITTER_BEARER_TOKEN=your_twitter_token
```

## Support

For issues or questions:
- GitHub Issues: [your-repo/issues]
- Email: support@example.com
- Documentation: https://docs.example.com