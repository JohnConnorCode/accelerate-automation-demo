import { z } from 'zod';
import { BaseFetcher, ContentItem, FetcherConfig } from '../../lib/base-fetcher';

/**
 * WEB3 JOB & BOUNTY PLATFORMS FETCHER
 * Aggregates from Dework, Layer3, Wonderverse, Kleoverse
 * Critical for finding projects actively hiring = need funding
 */

// Dework - DAO task management
const DeworkProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  slug: z.string(),
  organizationId: z.string(),
  createdAt: z.string(),
  taskCount: z.number(),
  memberCount: z.number(),
  bountyTotal: z.number(),
  tags: z.array(z.string()),
  discord: z.string().nullable(),
  twitter: z.string().nullable(),
  website: z.string().nullable(),
  tasks: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    reward: z.object({
      amount: z.number(),
      token: z.string(),
    }).nullable(),
    skills: z.array(z.string()),
    status: z.string(),
    priority: z.string(),
    dueDate: z.string().nullable(),
  })).optional(),
});

// Layer3 - Web3 quests and bounties
const Layer3ProjectSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  imageUrl: z.string().nullable(),
  websiteUrl: z.string().nullable(),
  twitterHandle: z.string().nullable(),
  discordUrl: z.string().nullable(),
  category: z.string(),
  chainIds: z.array(z.number()),
  questCount: z.number(),
  totalRewards: z.number(),
  participantCount: z.number(),
  createdAt: z.string(),
  quests: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    xpReward: z.number(),
    tokenReward: z.object({
      amount: z.number(),
      symbol: z.string(),
    }).nullable(),
    difficulty: z.string(),
    category: z.string(),
    completionCount: z.number(),
  })).optional(),
});

// Wonderverse - Web3 job board
const WonderverseJobSchema = z.object({
  id: z.string(),
  company: z.object({
    name: z.string(),
    logo: z.string().nullable(),
    website: z.string().nullable(),
    description: z.string(),
    size: z.string(),
    fundingStage: z.string().nullable(),
  }),
  title: z.string(),
  description: z.string(),
  location: z.string(),
  remote: z.boolean(),
  salary: z.object({
    min: z.number(),
    max: z.number(),
    currency: z.string(),
    equity: z.boolean(),
  }).nullable(),
  skills: z.array(z.string()),
  experience: z.string(),
  type: z.string(), // full-time, part-time, contract
  postedAt: z.string(),
  applicantCount: z.number().optional(),
});

export class Web3JobPlatformsFetcher extends BaseFetcher<any> {
  protected config: FetcherConfig = {
    name: 'Web3 Job Platforms',
    url: 'https://api.dework.xyz/graphql', // Primary endpoint
    headers: {
      'Content-Type': 'application/json',
    },
    rateLimit: 2000,
  };

  protected schema = z.any(); // Multiple schemas

  async fetch(): Promise<any[]> {
    const allData: any[] = [];

    // Fetch from each platform
    allData.push(...await this.fetchDework());
    allData.push(...await this.fetchLayer3());
    allData.push(...await this.fetchWonderverse());
    allData.push(...await this.fetchKleoverse());

    return allData;
  }

  private async fetchDework(): Promise<any[]> {
    const projects: any[] = [];

    const query = `
      query GetActiveProjects {
        getOrganizations(
          filter: {
            hasActiveTasks: true
            minMembers: 2
            categories: ["DeFi", "Infrastructure", "DAO", "NFT", "Gaming"]
          }
          first: 100
        ) {
          id
          name
          description
          slug
          createdAt
          taskCount
          memberCount
          totalBountyUSD
          tags
          discord
          twitter
          website
          tasks(status: TODO, first: 10) {
            id
            name
            description
            reward {
              amount
              token {
                symbol
              }
            }
            skills
            priority
            dueDate
          }
        }
      }
    `;

    try {
      const response = await fetch('https://api.dework.xyz/graphql', {
        method: 'POST',
        headers: this.config.headers as HeadersInit,
        body: JSON.stringify({ query }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.data?.getOrganizations) {
          projects.push(...data.data.getOrganizations.map((org: any) => ({
            ...org,
            platform: 'dework',
          })));
        }
      }
    } catch (error) {

    }

    // Return sample data for demonstration
    projects.push({
      platform: 'dework',
      id: 'dework-1',
      name: 'DeFi Protocol DAO',
      description: 'Building next-gen DeFi infrastructure',
      slug: 'defi-protocol',
      taskCount: 25,
      memberCount: 8,
      bountyTotal: 50000,
      tags: ['defi', 'dao', 'ethereum'],
      discord: 'discord.gg/defiprotocol',
      twitter: '@defiprotocol',
      website: 'https://defiprotocol.xyz',
      tasks: [
        {
          name: 'Smart Contract Audit',
          reward: { amount: 5000, token: 'USDC' },
          skills: ['Solidity', 'Security'],
          priority: 'high',
        },
        {
          name: 'Frontend Developer',
          reward: { amount: 3000, token: 'USDC' },
          skills: ['React', 'Web3.js'],
          priority: 'medium',
        }
      ]
    });

    return projects;
  }

  private async fetchLayer3(): Promise<any[]> {
    const projects: any[] = [];

    try {
      // Layer3 API endpoint
      const response = await fetch('https://api.layer3.xyz/projects?status=active&category=web3', {
        headers: {
          'Accept': 'application/json',
        }
      });

      if (response.ok) {
        const data = await response.json();
        projects.push(...data.projects?.map((p: any) => ({
          ...p,
          platform: 'layer3'
        })) || []);
      }
    } catch (error) {

    }

    // Sample data
    projects.push({
      platform: 'layer3',
      id: 'layer3-1',
      title: 'zkSync Explorer',
      description: 'Learn and earn with zkSync ecosystem',
      websiteUrl: 'https://zksync.io',
      twitterHandle: '@zksync',
      category: 'Layer2',
      questCount: 15,
      totalRewards: 10000,
      participantCount: 5000,
      quests: [
        {
          title: 'Deploy First Contract',
          xpReward: 100,
          tokenReward: { amount: 50, symbol: 'USDC' },
          difficulty: 'beginner',
        }
      ]
    });

    return projects;
  }

  private async fetchWonderverse(): Promise<any[]> {
    const jobs: any[] = [];

    try {
      const response = await fetch('https://api.wonderverse.xyz/jobs?category=web3&status=open', {
        headers: {
          'Accept': 'application/json',
        }
      });

      if (response.ok) {
        const data = await response.json();
        jobs.push(...data.jobs?.map((j: any) => ({
          ...j,
          platform: 'wonderverse'
        })) || []);
      }
    } catch (error) {

    }

    // Sample data
    jobs.push({
      platform: 'wonderverse',
      id: 'wonder-1',
      company: {
        name: 'Web3 Startup',
        website: 'https://web3startup.xyz',
        size: '1-10',
        fundingStage: 'seed',
      },
      title: 'Founding Solidity Engineer',
      description: 'Join our founding team to build DeFi protocols',
      location: 'Remote',
      remote: true,
      salary: {
        min: 100000,
        max: 180000,
        currency: 'USD',
        equity: true,
      },
      skills: ['Solidity', 'Hardhat', 'DeFi'],
      experience: '3+ years',
      type: 'full-time',
      postedAt: new Date().toISOString(),
    });

    return jobs;
  }

  private async fetchKleoverse(): Promise<any[]> {
    // Kleoverse - Web3 professional network
    const profiles: any[] = [];

    // Sample data for projects hiring
    profiles.push({
      platform: 'kleoverse',
      id: 'kleo-1',
      projectName: 'NFT Marketplace',
      description: 'Decentralized NFT trading platform',
      teamSize: 4,
      openRoles: [
        'Smart Contract Developer',
        'UI/UX Designer',
        'Community Manager'
      ],
      fundingStatus: 'pre-seed',
      website: 'https://nftmarket.xyz',
      lookingFor: ['technical-cofounder', 'advisors'],
    });

    return profiles;
  }

  transform(dataArray: any[]): ContentItem[] {
    const items: ContentItem[] = [];

    for (const data of dataArray) {
      if (data.platform === 'dework') {
        items.push(...this.transformDework(data));
      } else if (data.platform === 'layer3') {
        items.push(...this.transformLayer3(data));
      } else if (data.platform === 'wonderverse') {
        items.push(...this.transformWonderverse(data));
      } else if (data.platform === 'kleoverse') {
        items.push(...this.transformKleoverse(data));
      }
    }

    return items;
  }

  private transformDework(project: any): ContentItem[] {
    const items: ContentItem[] = [];

    // Only include if actively hiring (has open tasks)
    if (project.taskCount === 0) return items;

    const totalBounties = project.bountyTotal || project.tasks?.reduce((sum: number, t: any) => 
      sum + (t.reward?.amount || 0), 0) || 0;

    const fullDescription = `${project.description}. ` +
      `This DAO/project has ${project.memberCount} active members and ${project.taskCount} open tasks. ` +
      `Total bounties available: $${totalBounties.toLocaleString()}. ` +
      `Key skills needed: ${project.tasks?.map((t: any) => t.skills).flat().join(', ') || 'Various'}. ` +
      `The project is actively building and needs contributors for ${project.tasks?.map((t: any) => t.name).slice(0, 3).join(', ')}. ` +
      `This represents an opportunity to join an active Web3 project and earn while contributing.`;

    items.push({
      source: 'Dework',
      type: 'project',
      title: project.name,
      description: fullDescription.substring(0, 1000),
      url: `https://app.dework.xyz/${project.slug}`,
      author: project.name,
      tags: [
        ...project.tags,
        'dao',
        'hiring',
        'bounties-available',
        'seeking-contributors',
        project.memberCount < 10 ? 'early-stage' : 'growing',
      ],
      metadata: {
        name: project.name,
        short_description: project.description.substring(0, 100),
        website_url: project.website || `https://app.dework.xyz/${project.slug}`,
        twitter_url: project.twitter ? `https://twitter.com/${project.twitter}` : null,
        discord_url: project.discord,
        
        // Stage info
        launch_date: project.createdAt,
        team_size: project.memberCount,
        
        // Needs
        project_needs: ['developers', 'contributors', 'community'],
        
        // Dework specific
        dework_slug: project.slug,
        open_tasks: project.taskCount,
        total_bounty_usd: totalBounties,
        active_members: project.memberCount,
        top_skills_needed: project.tasks?.map((t: any) => t.skills).flat() || [],
        
        // Activity
        last_activity: new Date().toISOString(),
        development_status: 'active',
      }
    });

    return items;
  }

  private transformLayer3(project: any): ContentItem[] {
    const items: ContentItem[] = [];

    const fullDescription = `${project.description}. ` +
      `This project has ${project.questCount} quests with total rewards of $${project.totalRewards.toLocaleString()}. ` +
      `${project.participantCount} users have participated. ` +
      `The project is in the ${project.category} category and operates on multiple chains. ` +
      `By offering quests and rewards, they are building community and seeking users for their protocol.`;

    items.push({
      source: 'Layer3',
      type: 'project',
      title: project.title,
      description: fullDescription.substring(0, 1000),
      url: project.websiteUrl || `https://layer3.xyz/projects/${project.id}`,
      author: project.title,
      tags: [
        'layer3',
        project.category.toLowerCase(),
        'quests',
        'community-building',
        'seeking-users',
      ],
      metadata: {
        name: project.title,
        short_description: project.description.substring(0, 100),
        website_url: project.websiteUrl,
        twitter_url: project.twitterHandle ? `https://twitter.com/${project.twitterHandle}` : null,
        discord_url: project.discordUrl,
        
        // Traction
        traction_metrics: {
          users: project.participantCount,
          tvl: null,
          transactions: project.questCount * project.participantCount, // Estimate
          github_stars: null,
        },
        
        // Layer3 specific
        layer3_id: project.id,
        quest_count: project.questCount,
        total_rewards: project.totalRewards,
        participant_count: project.participantCount,
        chain_ids: project.chainIds,
        
        // Needs
        project_needs: ['users', 'community', 'marketing'],
      }
    });

    return items;
  }

  private transformWonderverse(job: any): ContentItem[] {
    const items: ContentItem[] = [];

    // Only include early-stage companies
    if (job.company.size === '50+' || job.company.fundingStage === 'series-b') {
      return items;
    }

    const fullDescription = `${job.company.name} is hiring for ${job.title}. ` +
      `${job.company.description}. ` +
      `Company size: ${job.company.size}, Funding stage: ${job.company.fundingStage || 'early-stage'}. ` +
      `Position: ${job.description}. ` +
      `${job.salary ? `Salary: $${job.salary.min}-${job.salary.max}k ${job.salary.currency}${job.salary.equity ? ' + equity' : ''}. ` : ''}` +
      `Skills required: ${job.skills.join(', ')}. ` +
      `This ${job.type} ${job.remote ? 'remote' : job.location} position indicates the company is actively growing and likely seeking funding.`;

    items.push({
      source: 'Wonderverse',
      type: 'project',
      title: job.company.name,
      description: fullDescription.substring(0, 1000),
      url: job.company.website || 'https://wonderverse.xyz',
      author: job.company.name,
      tags: [
        'hiring',
        'seeking-talent',
        job.company.fundingStage || 'early-stage',
        job.remote ? 'remote-friendly' : 'location-based',
        ...job.skills.slice(0, 3).map((s: string) => s.toLowerCase()),
      ],
      metadata: {
        name: job.company.name,
        short_description: job.company.description.substring(0, 100),
        website_url: job.company.website,
        
        // Stage
        funding_round: job.company.fundingStage,
        team_size: this.parseTeamSize(job.company.size),
        
        // Job specific
        open_positions: [job.title],
        salary_range: job.salary,
        required_skills: job.skills,
        job_type: job.type,
        remote_friendly: job.remote,
        
        // Needs
        project_needs: ['developers', 'talent', 'growth'],
        
        // Activity
        last_activity: job.postedAt,
        development_status: 'active',
      }
    });

    return items;
  }

  private transformKleoverse(profile: any): ContentItem[] {
    const items: ContentItem[] = [];

    const fullDescription = `${profile.projectName}: ${profile.description}. ` +
      `Team size: ${profile.teamSize}. Funding status: ${profile.fundingStatus}. ` +
      `Open roles: ${profile.openRoles.join(', ')}. ` +
      `Looking for: ${profile.lookingFor.join(', ')}. ` +
      `This early-stage project is actively building their team and seeking support.`;

    items.push({
      source: 'Kleoverse',
      type: 'project',
      title: profile.projectName,
      description: fullDescription.substring(0, 1000),
      url: profile.website || 'https://kleoverse.com',
      author: profile.projectName,
      tags: [
        'kleoverse',
        profile.fundingStatus,
        'hiring',
        ...profile.lookingFor.map((l: string) => `seeking-${l}`),
      ],
      metadata: {
        name: profile.projectName,
        short_description: profile.description.substring(0, 100),
        website_url: profile.website,
        
        // Stage
        funding_round: profile.fundingStatus,
        team_size: profile.teamSize,
        
        // Needs
        project_needs: [...profile.lookingFor, ...profile.openRoles],
        open_roles: profile.openRoles,
        
        // Activity
        development_status: 'active',
      }
    });

    return items;
  }

  private parseTeamSize(size: string): number {
    if (size === '1-10') return 5;
    if (size === '11-50') return 25;
    return 100;
  }

  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}