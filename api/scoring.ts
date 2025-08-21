import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../src/lib/supabase-client';

interface ScoringRule {
  id: string;
  name: string;
  field: string;
  operator: 'greater' | 'less' | 'equals' | 'contains' | 'between';
  value: any;
  points: number;
  weight: number;
  enabled: boolean;
}

interface ScoringFormula {
  id: string;
  name: string;
  description: string;
  rules: ScoringRule[];
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Get current formula or create default
  if (req.method === 'GET') {
    const { data: formula } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'scoring_formula')
      .single();

    const defaultFormula: ScoringFormula = {
      id: 'default',
      name: 'Default Accelerate Scoring',
      description: 'Standard scoring for Web3 startups',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      rules: [
        {
          id: '1',
          name: 'Early Stage Funding',
          field: 'amount_funded',
          operator: 'between',
          value: [0, 500000],
          points: 30,
          weight: 1,
          enabled: true
        },
        {
          id: '2',
          name: 'Small Team',
          field: 'team_size',
          operator: 'between',
          value: [1, 10],
          points: 20,
          weight: 1,
          enabled: true
        },
        {
          id: '3',
          name: 'Recent Launch',
          field: 'launched_date',
          operator: 'greater',
          value: '2024-01-01',
          points: 20,
          weight: 1,
          enabled: true
        },
        {
          id: '4',
          name: 'High Social Score',
          field: 'social_score',
          operator: 'greater',
          value: 70,
          points: 15,
          weight: 1.2,
          enabled: true
        },
        {
          id: '5',
          name: 'GitHub Activity',
          field: 'github_stars',
          operator: 'greater',
          value: 50,
          points: 10,
          weight: 1,
          enabled: true
        },
        {
          id: '6',
          name: 'Has Twitter',
          field: 'twitter_followers',
          operator: 'greater',
          value: 0,
          points: 5,
          weight: 1,
          enabled: true
        }
      ]
    };

    return res.status(200).json(formula?.value || defaultFormula);
  }

  // Update formula
  if (req.method === 'POST') {
    const { formula, testItemId } = req.body;

    // Save formula
    const { error } = await supabase
      .from('system_settings')
      .upsert({
        key: 'scoring_formula',
        value: formula,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });

    if (error) {
      return res.status(500).json({ error: 'Failed to save formula' });
    }

    // If test item provided, calculate its score
    if (testItemId) {
      const score = await calculateScore(testItemId, formula);
      return res.status(200).json({ 
        success: true, 
        message: 'Formula saved',
        testScore: score 
      });
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Formula saved successfully' 
    });
  }

  // Test scoring on specific item
  if (req.method === 'PUT') {
    const { itemId, formula } = req.body;
    const score = await calculateScore(itemId, formula);
    
    return res.status(200).json({ 
      itemId,
      score,
      breakdown: await getScoreBreakdown(itemId, formula)
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

async function calculateScore(itemId: string, formula: ScoringFormula): Promise<number> {
  // Fetch item from database
  const { data: item } = await supabase
    .from('projects')
    .select('*')
    .eq('id', itemId)
    .single();

  if (!item) return 0;

  let totalScore = 0;

  for (const rule of formula.rules) {
    if (!rule.enabled) continue;

    const fieldValue = item[rule.field];
    let matches = false;

    switch (rule.operator) {
      case 'greater':
        matches = fieldValue > rule.value;
        break;
      case 'less':
        matches = fieldValue < rule.value;
        break;
      case 'equals':
        matches = fieldValue === rule.value;
        break;
      case 'contains':
        matches = fieldValue && fieldValue.toString().includes(rule.value);
        break;
      case 'between':
        matches = fieldValue >= rule.value[0] && fieldValue <= rule.value[1];
        break;
    }

    if (matches) {
      totalScore += rule.points * rule.weight;
    }
  }

  return Math.min(100, Math.round(totalScore));
}

async function getScoreBreakdown(itemId: string, formula: ScoringFormula): Promise<any> {
  const { data: item } = await supabase
    .from('projects')
    .select('*')
    .eq('id', itemId)
    .single();

  if (!item) return null;

  const breakdown = [];

  for (const rule of formula.rules) {
    if (!rule.enabled) continue;

    const fieldValue = item[rule.field];
    let matches = false;

    switch (rule.operator) {
      case 'greater':
        matches = fieldValue > rule.value;
        break;
      case 'less':
        matches = fieldValue < rule.value;
        break;
      case 'equals':
        matches = fieldValue === rule.value;
        break;
      case 'contains':
        matches = fieldValue && fieldValue.toString().includes(rule.value);
        break;
      case 'between':
        matches = fieldValue >= rule.value[0] && fieldValue <= rule.value[1];
        break;
    }

    breakdown.push({
      rule: rule.name,
      field: rule.field,
      value: fieldValue,
      condition: `${rule.operator} ${JSON.stringify(rule.value)}`,
      matched: matches,
      points: matches ? rule.points * rule.weight : 0
    });
  }

  return breakdown;
}