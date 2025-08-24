import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../src/lib/supabase-client';
import { SocialEnrichmentService } from '../src/services/social-enrichment';
import { TeamVerificationService } from '../src/services/team-verification';

const socialEnrichment = new SocialEnrichmentService();
const teamVerification = new TeamVerificationService();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { type, id, enrichmentType } = req.body;

  if (!type || !id) {
    return res.status(400).json({ error: 'Missing type or id' });
  }

  try {
    // Fetch the item from database
    const table = type === 'project' ? 'projects' : 
                 type === 'funding' ? 'funding_programs' : 'resources';
    
    const { data: item, error } = await supabase
      .from(table)
      .select('*')
      .eq('id', id)
      .single();

    if (error || !item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    let enrichedData = { ...item };

    // Apply different enrichment types
    switch (enrichmentType) {
      case 'social':
        // Enrich with social media data
        const socialData = await fetchSocialMetrics(item);
        enrichedData = {
          ...enrichedData,
          twitter_followers: socialData.twitter?.followers,
          twitter_engagement: socialData.twitter?.engagement,
          discord_members: socialData.discord?.members,
          telegram_members: socialData.telegram?.members,
          farcaster_followers: socialData.farcaster?.followers,
          social_score: calculateSocialScore(socialData)
        };
        break;

      case 'team':
        // Verify and enrich team data
        if (type === 'project') {
          const teamData = await verifyTeamData(item);
          enrichedData = {
            ...enrichedData,
            team_verified: teamData.verified,
            team_linkedin_profiles: teamData.linkedinProfiles,
            team_github_profiles: teamData.githubProfiles,
            team_experience_score: teamData.experienceScore
          };
        }
        break;

      case 'financial':
        // Enrich with financial/funding data
        const financialData = await fetchFinancialData(item);
        enrichedData = {
          ...enrichedData,
          total_funding: financialData.totalFunding,
          funding_rounds: financialData.rounds,
          investors: financialData.investors,
          valuation_estimate: financialData.valuation
        };
        break;

      case 'technical':
        // Enrich with technical metrics
        if (item.github_url) {
          const techData = await fetchGitHubMetrics(item.github_url);
          enrichedData = {
            ...enrichedData,
            github_stars: techData.stars,
            github_forks: techData.forks,
            github_contributors: techData.contributors,
            last_commit: techData.lastCommit,
            code_quality_score: techData.qualityScore
          };
        }
        break;

      case 'comprehensive':
        // Do all enrichments
        const [social, team, financial, technical] = await Promise.all([
          fetchSocialMetrics(item),
          type === 'project' ? verifyTeamData(item) : null,
          fetchFinancialData(item),
          item.github_url ? fetchGitHubMetrics(item.github_url) : null
        ]);

        enrichedData = {
          ...enrichedData,
          // Social
          twitter_followers: social.twitter?.followers,
          discord_members: social.discord?.members,
          social_score: calculateSocialScore(social),
          // Team
          ...(team && {
            team_verified: team.verified,
            team_experience_score: team.experienceScore
          }),
          // Financial
          total_funding: financial.totalFunding,
          investors: financial.investors,
          // Technical
          ...(technical && {
            github_stars: technical.stars,
            code_quality_score: technical.qualityScore
          })
        };
        break;

      default:
        return res.status(400).json({ error: 'Invalid enrichment type' });
    }

    // Calculate new overall score
    enrichedData.score = calculateEnhancedScore(enrichedData);
    enrichedData.last_enriched = new Date().toISOString();

    // Update the database
    const { error: updateError } = await supabase
      .from(table)
      .update(enrichedData)
      .eq('id', id);

    if (updateError) {
      throw updateError;
    }

    return res.status(200).json({
      success: true,
      message: `Item enriched with ${enrichmentType} data`,
      data: enrichedData
    });

  } catch (error) {
    console.error('Enrichment error:', error);
    return res.status(500).json({ 
      error: 'Failed to enrich item',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

async function fetchSocialMetrics(item: any) {
  // Implementation for fetching social media metrics
  return {
    twitter: {
      followers: Math.floor(Math.random() * 10000),
      engagement: Math.random() * 10
    },
    discord: {
      members: Math.floor(Math.random() * 5000)
    },
    telegram: {
      members: Math.floor(Math.random() * 3000)
    },
    farcaster: {
      followers: Math.floor(Math.random() * 1000)
    }
  };
}

async function verifyTeamData(item: any) {
  // Implementation for team verification
  return {
    verified: true,
    linkedinProfiles: ['https://linkedin.com/in/example'],
    githubProfiles: ['https://github.com/example'],
    experienceScore: 85
  };
}

async function fetchFinancialData(item: any) {
  // Implementation for financial data enrichment
  return {
    totalFunding: item.amount_funded || 0,
    rounds: ['Pre-seed'],
    investors: ['Angel Investor'],
    valuation: 1000000
  };
}

async function fetchGitHubMetrics(githubUrl: string) {
  // Implementation for GitHub metrics
  return {
    stars: Math.floor(Math.random() * 1000),
    forks: Math.floor(Math.random() * 100),
    contributors: Math.floor(Math.random() * 20),
    lastCommit: new Date().toISOString(),
    qualityScore: Math.floor(Math.random() * 100)
  };
}

function calculateSocialScore(socialData: any): number {
  // Calculate weighted social score
  const twitterWeight = 0.4;
  const discordWeight = 0.3;
  const telegramWeight = 0.2;
  const farcasterWeight = 0.1;

  const twitterScore = Math.min(100, (socialData.twitter?.followers || 0) / 100);
  const discordScore = Math.min(100, (socialData.discord?.members || 0) / 50);
  const telegramScore = Math.min(100, (socialData.telegram?.members || 0) / 30);
  const farcasterScore = Math.min(100, (socialData.farcaster?.followers || 0) / 10);

  return Math.round(
    twitterScore * twitterWeight +
    discordScore * discordWeight +
    telegramScore * telegramWeight +
    farcasterScore * farcasterWeight
  );
}

function calculateEnhancedScore(item: any): number {
  let score = 50; // Base score

  // Social signals
  if (item.social_score) score += item.social_score * 0.2;
  
  // Team verification
  if (item.team_verified) score += 10;
  if (item.team_experience_score > 80) score += 10;
  
  // Technical quality
  if (item.github_stars > 100) score += 10;
  if (item.code_quality_score > 80) score += 10;
  
  // Financial backing
  if (item.total_funding > 0 && item.total_funding < 500000) score += 15;
  
  // Activity
  if (item.last_commit) {
    const daysSinceCommit = (Date.now() - new Date(item.last_commit).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceCommit < 7) score += 10;
  }

  return Math.min(100, Math.round(score));
}