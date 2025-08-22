import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../src/lib/supabase-client';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { event, data } = req.body;

    // Log webhook event
    await supabase
      .from('webhook_logs')
      .insert({
        event_type: event,
        payload: data,
        source: req.headers['x-webhook-source'] || 'unknown',
        created_at: new Date().toISOString()
      });

    // Handle different webhook events
    switch (event) {
      case 'content.approved':
        // Notify subscribers
        await notifySubscribers(data);
        break;
      
      case 'content.high_score':
        // Alert admin about high-scoring content
        console.log('High score content:', data);
        break;
      
      case 'fetch.complete':
        // Log fetch completion
        console.log('Fetch completed:', data);
        break;
      
      default:
        console.log('Unknown webhook event:', event);
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Webhook received',
      event 
    });
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ 
      error: 'Webhook processing failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

async function notifySubscribers(data: any) {
  // Get all active webhook subscriptions
  const { data: subscriptions } = await supabase
    .from('webhook_subscriptions')
    .select('*')
    .eq('active', true)
    .eq('event_type', 'content.approved');

  if (!subscriptions) return;

  // Send webhooks to all subscribers
  for (const subscription of subscriptions) {
    try {
      await fetch(subscription.webhook_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Event': 'content.approved',
          'X-Webhook-Signature': generateSignature(data, subscription.secret)
        },
        body: JSON.stringify(data)
      });
    } catch (error) {
      console.error(`Failed to notify ${subscription.webhook_url}:`, error);
    }
  }
}

function generateSignature(data: any, secret: string): string {
  // Simple signature generation (in production, use proper HMAC)
  return Buffer.from(JSON.stringify(data) + secret).toString('base64');
}