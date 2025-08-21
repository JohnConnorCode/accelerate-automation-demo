# Webhook Integration Guide

## Overview

The Accelerate Content Automation system supports both **incoming** and **outgoing** webhooks for real-time content updates.

## Incoming Webhooks

Receive real-time content notifications from external sources.

### Supported Sources

1. **GitHub**
   - New repository creation
   - Release publications
   - Repository starring milestones

2. **ProductHunt**
   - Product launches
   - Featured products

3. **Gitcoin**
   - New grant announcements
   - Grant updates

4. **Custom**
   - Generic content submission

### Endpoint

```
POST /api/webhooks/incoming?source={source}
```

### Authentication

Include signature in headers:
```
X-Webhook-Signature: {HMAC-SHA256 signature}
```

### Example: GitHub Webhook

```json
POST /api/webhooks/incoming?source=github

{
  "action": "created",
  "repository": {
    "html_url": "https://github.com/user/repo",
    "name": "awesome-web3-tool",
    "description": "A tool for Web3 developers",
    "topics": ["web3", "blockchain"],
    "stargazers_count": 100
  }
}
```

### Example: Custom Webhook

```json
POST /api/webhooks/incoming?source=custom

{
  "url": "https://example.com/resource",
  "title": "New Web3 Resource",
  "description": "Description of the resource",
  "content_type": "resource",
  "tags": ["defi", "tutorial"],
  "metadata": {
    "author": "John Doe",
    "category": "development"
  }
}
```

## Outgoing Webhooks

Get notified when content events occur in the system.

### Available Events

- `content.created` - New content added to queue
- `content.updated` - Content updated
- `content.approved` - Content approved for publishing
- `content.rejected` - Content rejected
- `fetch.completed` - Fetch job completed
- `fetch.failed` - Fetch job failed
- `ai.scoring.completed` - AI scoring completed
- `threshold.reached` - Content threshold reached

### Registering a Webhook

```bash
curl -X POST https://your-app.vercel.app/api/webhooks/register \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-server.com/webhook",
    "events": ["content.approved", "content.rejected"],
    "secret": "your-webhook-secret",
    "headers": {
      "X-Custom-Header": "value"
    }
  }'
```

### Webhook Payload Format

```json
{
  "event": "content.approved",
  "timestamp": "2024-01-27T10:00:00Z",
  "data": {
    "id": "uuid",
    "title": "Resource Title",
    "url": "https://example.com",
    "content_type": "resource",
    "ai_score": 0.85
  },
  "metadata": {
    "webhookId": "wh_123456",
    "deliveryId": "del_789012",
    "attempt": 1
  }
}
```

### Webhook Headers

Every webhook delivery includes:

- `X-Webhook-Event`: Event type
- `X-Webhook-Delivery`: Unique delivery ID
- `X-Webhook-Timestamp`: ISO timestamp
- `X-Webhook-Signature`: HMAC-SHA256 signature

### Signature Verification

```javascript
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return signature === expected;
}
```

## Managing Webhooks

### List Webhooks

```bash
curl https://your-app.vercel.app/api/webhooks/manage \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY"
```

### Update Webhook

```bash
curl -X PUT https://your-app.vercel.app/api/webhooks/manage?id=wh_123 \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "events": ["content.approved"],
    "active": true
  }'
```

### Delete Webhook

```bash
curl -X DELETE https://your-app.vercel.app/api/webhooks/manage?id=wh_123 \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY"
```

### Test Webhook

```bash
curl -X POST https://your-app.vercel.app/api/webhooks/manage?id=wh_123 \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY"
```

## View Delivery History

```bash
curl "https://your-app.vercel.app/api/webhooks/deliveries?webhook_id=wh_123" \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY"
```

## Retry Policy

- **Max Retries**: 3 attempts
- **Backoff**: Exponential (1s, 2s, 4s)
- **Timeout**: 30 seconds per request

## Best Practices

1. **Always verify signatures** for incoming webhooks
2. **Respond quickly** (< 3 seconds) to webhook deliveries
3. **Process asynchronously** - queue work for background processing
4. **Return 2xx status** to indicate successful receipt
5. **Implement idempotency** - handle duplicate deliveries gracefully

## Error Handling

Failed webhooks will be retried with exponential backoff. After max retries, the delivery is marked as failed and logged.

### Common Error Codes

- `400` - Invalid payload or parameters
- `401` - Authentication failed
- `404` - Webhook endpoint not found
- `429` - Rate limit exceeded
- `500` - Server error

## Rate Limits

- Incoming webhooks: 100 requests per minute
- Outgoing webhooks: No limit (we retry failed deliveries)

## Security Considerations

1. **Use HTTPS** for all webhook endpoints
2. **Rotate secrets** regularly
3. **Validate payloads** before processing
4. **Log all webhook activity** for auditing
5. **Implement rate limiting** on your endpoints

## Example Integration

### Node.js Express Server

```javascript
const express = require('express');
const crypto = require('crypto');

const app = express();
app.use(express.json());

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

app.post('/webhook', (req, res) => {
  // Verify signature
  const signature = req.headers['x-webhook-signature'];
  const payload = JSON.stringify(req.body);
  
  const expected = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
  
  if (signature !== expected) {
    return res.status(401).send('Invalid signature');
  }
  
  // Process webhook
  const { event, data } = req.body;
  
  switch (event) {
    case 'content.approved':
      console.log('New content approved:', data.title);
      // Queue for processing
      break;
    case 'content.rejected':
      console.log('Content rejected:', data.title);
      break;
  }
  
  // Acknowledge receipt
  res.status(200).send('OK');
});

app.listen(3000);
```

## Testing Webhooks

Use ngrok for local development:

```bash
# Install ngrok
npm install -g ngrok

# Expose local server
ngrok http 3000

# Register webhook with ngrok URL
curl -X POST https://your-app.vercel.app/api/webhooks/register \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  -d '{
    "url": "https://abc123.ngrok.io/webhook",
    "events": ["content.approved"]
  }'
```

## Monitoring

Monitor webhook health through:

1. **Delivery Stats API**: `/api/webhooks/deliveries`
2. **Admin Dashboard**: View success/failure rates
3. **Logs**: Check Vercel logs for webhook activity

## Support

For webhook issues:

1. Check delivery history for error messages
2. Verify signature implementation
3. Test with webhook testing tool
4. Review rate limit headers