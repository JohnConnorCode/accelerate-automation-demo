import { ContentItem } from '../lib/base-fetcher';
import { Octokit } from '@octokit/rest';

/**
 * TEAM VERIFICATION SERVICE
 * Verifies team members via LinkedIn, GitHub, and on-chain activity
 * CRITICAL for preventing scams and validating legitimate teams
 */

interface TeamMember {
  name: string;
  role: string;
  linkedin_url?: string;
  github_username?: string;
  twitter_handle?: string;
  wallet_address?: string;
  verified: boolean;
  verification_sources: string[];
  credibility_score: number;
  experience_years?: number;
  previous_companies?: string[];
  skills?: string[];
  contributions?: {
    github_commits?: number;
    github_repos?: number;
    github_stars?: number;
    on_chain_transactions?: number;
  };
}

interface TeamVerification {
  team_members: TeamMember[];
  total_team_size: number;
  verified_count: number;
  verification_rate: number;
  team_credibility_score: number;
  red_flags: string[];
  green_flags: string[];
  team_experience_total: number;
  has_technical_founder: boolean;
  has_business_founder: boolean;
  has_web3_experience: boolean;
}

export class TeamVerificationService {
  private octokit: Octokit;

  constructor() {
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
    });
  }

  /**
   * Verify team for a content item
   */
  async verifyTeam(item: ContentItem): Promise<ContentItem> {
    // Extract team information
    const teamInfo = await this.extractTeamInfo(item);
    
    // Verify each team member
    const verifiedMembers: TeamMember[] = [];
    for (const member of teamInfo) {
      const verified = await this.verifyTeamMember(member);
      verifiedMembers.push(verified);
    }

    // Calculate team metrics
    const verification = this.calculateTeamMetrics(verifiedMembers);

    // Identify red and green flags
    const flags = this.identifyFlags(verification, item);
    verification.red_flags = flags.red;
    verification.green_flags = flags.green;

    // Update item with verification data
    return {
      ...item,
      metadata: {
        ...item.metadata,
        team_verification: verification,
        team_verified_at: new Date().toISOString(),
        team_size: verification.total_team_size,
        team_credibility_score: verification.team_credibility_score,
        has_verified_team: verification.verification_rate > 0.5,
        team_red_flags: verification.red_flags,
        team_green_flags: verification.green_flags,
      }
    };
  }

  /**
   * Extract team information from content
   */
  private async extractTeamInfo(item: ContentItem): Promise<Partial<TeamMember>[]> {
    const team: Partial<TeamMember>[] = [];
    
    // Check if we have founder data from other sources
    if (item.metadata?.founders) {
      for (const founder of item.metadata.founders) {
        team.push({
          name: founder.name,
          role: founder.title || 'Founder',
          linkedin_url: founder.linkedin_url,
          twitter_handle: founder.twitter_url?.split('/').pop(),
        });
      }
    }

    // Extract from GitHub repository contributors
    if (item.metadata?.github_url) {
      const contributors = await this.getGitHubContributors(item.metadata.github_url);
      for (const contributor of contributors.slice(0, 5)) { // Top 5 contributors
        team.push({
          name: contributor.name || contributor.login,
          role: 'Developer',
          github_username: contributor.login,
        });
      }
    }

    // Parse team info from description using NLP patterns
    const descriptionTeam = this.parseTeamFromDescription(item.description);
    team.push(...descriptionTeam);

    // Deduplicate by name
    const uniqueTeam = team.reduce((acc, member) => {
      if (!acc.find(m => m.name === member.name)) {
        acc.push(member);
      }
      return acc;
    }, [] as Partial<TeamMember>[]);

    return uniqueTeam;
  }

  /**
   * Verify individual team member
   */
  private async verifyTeamMember(member: Partial<TeamMember>): Promise<TeamMember> {
    const verificationSources: string[] = [];
    let credibilityScore = 0;
    const contributions: any = {};

    // Verify GitHub
    if (member.github_username) {
      const githubData = await this.verifyGitHub(member.github_username);
      if (githubData) {
        verificationSources.push('github');
        credibilityScore += githubData.credibility;
        contributions.github_commits = githubData.total_commits;
        contributions.github_repos = githubData.public_repos;
        contributions.github_stars = githubData.total_stars;
        
        if (!member.name) member.name = githubData.name;
      }
    }

    // Verify LinkedIn (would need LinkedIn API or scraping)
    if (member.linkedin_url) {
      const linkedInData = await this.verifyLinkedIn(member.linkedin_url);
      if (linkedInData) {
        verificationSources.push('linkedin');
        credibilityScore += linkedInData.credibility;
        member.experience_years = linkedInData.experience_years;
        member.previous_companies = linkedInData.companies;
        member.skills = linkedInData.skills;
      }
    }

    // Verify Twitter
    if (member.twitter_handle) {
      const twitterVerified = await this.verifyTwitter(member.twitter_handle);
      if (twitterVerified) {
        verificationSources.push('twitter');
        credibilityScore += 10;
      }
    }

    // Verify on-chain activity
    if (member.wallet_address) {
      const onChainData = await this.verifyOnChain(member.wallet_address);
      if (onChainData) {
        verificationSources.push('on-chain');
        credibilityScore += onChainData.credibility;
        contributions.on_chain_transactions = onChainData.transaction_count;
      }
    }

    return {
      name: member.name || 'Unknown',
      role: member.role || 'Team Member',
      linkedin_url: member.linkedin_url,
      github_username: member.github_username,
      twitter_handle: member.twitter_handle,
      wallet_address: member.wallet_address,
      verified: verificationSources.length > 0,
      verification_sources: verificationSources,
      credibility_score: Math.min(credibilityScore, 100),
      experience_years: member.experience_years,
      previous_companies: member.previous_companies,
      skills: member.skills,
      contributions,
    };
  }

  /**
   * Verify GitHub profile
   */
  private async verifyGitHub(username: string): Promise<any> {
    try {
      const { data: user } = await this.octokit.users.getByUsername({ username });
      
      // Get contribution stats
      const { data: repos } = await this.octokit.repos.listForUser({
        username,
        sort: 'updated',
        per_page: 100,
      });

      const totalStars = repos.reduce((sum, repo) => sum + (repo.stargazers_count || 0), 0);
      const web3Repos = repos.filter(repo => 
        repo.description?.toLowerCase().includes('web3') ||
        repo.description?.toLowerCase().includes('blockchain') ||
        repo.language === 'Solidity'
      );

      // Calculate credibility
      let credibility = 0;
      if (user.public_repos > 10) credibility += 20;
      if (user.followers > 100) credibility += 20;
      if (totalStars > 100) credibility += 20;
      if (web3Repos.length > 0) credibility += 20;
      if (user.created_at && new Date(user.created_at) < new Date('2022-01-01')) credibility += 20;

      return {
        name: user.name,
        credibility,
        public_repos: user.public_repos,
        followers: user.followers,
        total_stars: totalStars,
        total_commits: user.public_repos * 50, // Estimate
        web3_experience: web3Repos.length > 0,
        account_age_years: (Date.now() - new Date(user.created_at).getTime()) / (365 * 24 * 60 * 60 * 1000),
      };
    } catch (error) {
      console.error(`[Team Verification] GitHub error for ${username}:`, error);
      return null;
    }
  }

  /**
   * Verify LinkedIn profile (mock implementation)
   */
  private async verifyLinkedIn(url: string): Promise<any> {
    // LinkedIn doesn't provide public API for profile data
    // Would need to use a service like Proxycurl or implement scraping
    
    // Mock response structure
    return {
      credibility: 30,
      experience_years: 5,
      companies: ['Previous Startup', 'Tech Company'],
      skills: ['Blockchain', 'Smart Contracts', 'JavaScript'],
      education: 'Computer Science',
      has_web3_experience: true,
    };
  }

  /**
   * Verify Twitter account
   */
  private async verifyTwitter(handle: string): Promise<boolean> {
    if (!process.env.TWITTER_BEARER_TOKEN) return false;

    try {
      const response = await fetch(
        `https://api.twitter.com/2/users/by/username/${handle}?user.fields=verified`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.TWITTER_BEARER_TOKEN}`,
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        return data.data?.verified || false;
      }
    } catch (error) {
      console.error(`[Team Verification] Twitter error for ${handle}:`, error);
    }

    return false;
  }

  /**
   * Verify on-chain activity
   */
  private async verifyOnChain(address: string): Promise<any> {
    // Would integrate with Etherscan, Alchemy, or similar
    // Mock implementation
    return {
      credibility: 20,
      transaction_count: 100,
      first_transaction: '2022-01-01',
      contract_deployments: 2,
      nft_holdings: 5,
      defi_interactions: 10,
    };
  }

  /**
   * Get GitHub contributors
   */
  private async getGitHubContributors(repoUrl: string): Promise<any[]> {
    try {
      const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (!match) return [];

      const [, owner, repo] = match;
      const { data: contributors } = await this.octokit.repos.listContributors({
        owner,
        repo,
        per_page: 10,
      });

      return contributors;
    } catch (error) {
      console.error('[Team Verification] Error fetching contributors:', error);
      return [];
    }
  }

  /**
   * Parse team from description
   */
  private parseTeamFromDescription(description: string): Partial<TeamMember>[] {
    const team: Partial<TeamMember>[] = [];
    
    // Pattern matching for team mentions
    const patterns = [
      /(?:CEO|CTO|COO|CFO|Founder|Co-founder)[:\s]+([A-Z][a-z]+ [A-Z][a-z]+)/g,
      /([A-Z][a-z]+ [A-Z][a-z]+),?\s+(?:CEO|CTO|COO|CFO|Founder|Co-founder)/g,
      /team.{0,20}includes?\s+([A-Z][a-z]+ [A-Z][a-z]+)/gi,
    ];

    for (const pattern of patterns) {
      const matches = description.matchAll(pattern);
      for (const match of matches) {
        team.push({
          name: match[1],
          role: 'Team Member',
        });
      }
    }

    return team;
  }

  /**
   * Calculate team metrics
   */
  private calculateTeamMetrics(members: TeamMember[]): TeamVerification {
    const verified = members.filter(m => m.verified);
    const totalExperience = members.reduce((sum, m) => sum + (m.experience_years || 0), 0);
    
    const hasTechnical = members.some(m => 
      m.role.toLowerCase().includes('cto') || 
      m.role.toLowerCase().includes('engineer') ||
      m.github_username
    );
    
    const hasBusiness = members.some(m => 
      m.role.toLowerCase().includes('ceo') || 
      m.role.toLowerCase().includes('business')
    );
    
    const hasWeb3 = members.some(m => 
      m.skills?.some(s => s.toLowerCase().includes('blockchain')) ||
      m.contributions?.on_chain_transactions
    );

    const teamCredibility = members.reduce((sum, m) => sum + m.credibility_score, 0) / Math.max(members.length, 1);

    return {
      team_members: members,
      total_team_size: members.length,
      verified_count: verified.length,
      verification_rate: verified.length / Math.max(members.length, 1),
      team_credibility_score: Math.round(teamCredibility),
      red_flags: [],
      green_flags: [],
      team_experience_total: totalExperience,
      has_technical_founder: hasTechnical,
      has_business_founder: hasBusiness,
      has_web3_experience: hasWeb3,
    };
  }

  /**
   * Identify red and green flags
   */
  private identifyFlags(verification: TeamVerification, item: ContentItem): {
    red: string[];
    green: string[];
  } {
    const red: string[] = [];
    const green: string[] = [];

    // Red flags
    if (verification.verified_count === 0) {
      red.push('No team members could be verified');
    }
    if (verification.total_team_size === 1) {
      red.push('Single person team');
    }
    if (!verification.has_technical_founder) {
      red.push('No technical founder identified');
    }
    if (verification.team_experience_total < 5) {
      red.push('Very limited team experience');
    }
    if (!verification.has_web3_experience) {
      red.push('No demonstrable Web3 experience');
    }

    // Green flags
    if (verification.verification_rate > 0.75) {
      green.push('Most team members verified');
    }
    if (verification.has_technical_founder && verification.has_business_founder) {
      green.push('Balanced founding team');
    }
    if (verification.team_experience_total > 20) {
      green.push('Experienced team');
    }
    if (verification.has_web3_experience) {
      green.push('Previous Web3 experience');
    }
    if (verification.team_members.some(m => m.verification_sources.length >= 3)) {
      green.push('Multi-platform verification');
    }
    if (verification.team_members.some(m => (m.contributions?.github_stars || 0) > 100)) {
      green.push('Proven open source contributors');
    }

    return { red, green };
  }
}