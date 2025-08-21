import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../src/lib/supabase-client';

interface WebhookSubscription {
  url: string;
  events: ('new_project' | 'new_funding' | 'high_score')[];
  filters?: {
    min_score?: number;
    funding_amount?: number;
    tags?: string[];
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url, events, filters }: WebhookSubscription = req.body;

  if (!url || !events || events.length === 0) {
    return res.status(400).json({ 
      error: 'Missing required fields: url, events' 
    });
  }

  try {
    // Store webhook subscription
    const { data, error } = await supabase
      .from('webhook_subscriptions')
      .insert({
        webhook_url: url,
        events: events,
        filters: filters || {},
        active: true,
        created_at: new Date()
      })
      .select()
      .single();

    if (error) {
      // Table might not exist, create it
      if (error.code === '42P01') {
        await supabase.rpc('create_webhook_table');
        return res.status(200).json({
          success: true,
          message: 'Webhook table created, please retry subscription'
        });
      }
      throw error;
    }

    return res.status(200).json({
      success: true,
      subscription_id: data.id,
      message: `Webhook registered for events: ${events.join(', ')}`,
      webhook_url: url,
      filters: filters || {}
    });
  } catch (error) {
    console.error('Webhook subscription error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to create webhook subscription' 
    });
  }
}