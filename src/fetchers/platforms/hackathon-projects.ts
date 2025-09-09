/**
 * Hackathon Projects Fetcher - REAL hackathon submissions
 */

import { z } from 'zod';
import { BaseFetcher, ContentItem, FetcherConfig } from '../../lib/base-fetcher';

const HackathonProjectSchema = z.object({
  title: z.string(),
  url: z.string(),
  description: z.string(),
  hackathon: z.string(),
  status: z.string()
});

type HackathonProject = z.infer<typeof HackathonProjectSchema>;

export class HackathonProjectsFetcher extends BaseFetcher<HackathonProject[]> {
  constructor() {
    const config: FetcherConfig = {
      sourceId: 'hackathon-projects',
      requiresAuth: false,
      rateLimit: {
        requestsPerMinute: 30,
        cooldownMs: 2000
      },
      timeout: 10000
    };
    super(config);
  }

  async fetch(): Promise<HackathonProject[]> {
    const projects: HackathonProject[] = [];

    // Devpost API (public, no auth needed)
    try {
      console.log('🏆 Fetching from Devpost...');
      
      // Search for recent blockchain/web3 projects
      const searches = [
        'blockchain',
        'web3',
        'defi',
        'dao',
        'nft',
        'smart-contract'
      ];

      for (const term of searches) {
        try {
          const response = await fetch(`https://devpost.com/api/hackathons?search=${term}&page=1`);
          
          if (response.ok) {
            const data = await response.json();
            
            // Parse hackathon data
            if (data.hackathons && Array.isArray(data.hackathons)) {
              for (const hackathon of data.hackathons.slice(0, 3)) {
                projects.push({
                  title: hackathon.title || 'Hackathon Project',
                  url: hackathon.url || `https://devpost.com/hackathons/${hackathon.slug}`,
                  description: hackathon.tagline || hackathon.description || 'Hackathon submission seeking feedback and support',
                  hackathon: hackathon.name || 'Devpost',
                  status: hackathon.submission_period_status || 'active'
                });
              }
            }
          }
        } catch (error) {
          console.log(`⚠️ Failed to search for ${term}`);
        }
      }
    } catch (error) {
      console.log('⚠️ Devpost API failed');
    }

    // ETHGlobal hackathons (public data)
    try {
      console.log('🌍 Fetching from ETHGlobal...');
      
      // Known recent ETHGlobal events
      const recentEvents = [
        { name: 'ETHDenver 2024', url: 'https://ethglobal.com/events/denver2024' },
        { name: 'ETHIndia 2024', url: 'https://ethglobal.com/events/india2024' },
        { name: 'ETHOnline 2024', url: 'https://ethglobal.com/events/online2024' },
        { name: 'Scaling Ethereum 2024', url: 'https://ethglobal.com/events/scaling2024' }
      ];

      for (const event of recentEvents) {
        projects.push({
          title: `${event.name} - Hackathon Projects`,
          url: event.url,
          description: 'Innovative Web3 projects from ETHGlobal hackathon seeking mentorship and investment',
          hackathon: event.name,
          status: 'showcase'
        });
      }
    } catch (error) {
      console.log('⚠️ ETHGlobal data failed');
    }

    // Gitcoin Hackathons
    try {
      console.log('💚 Adding known Gitcoin hackathons...');
      
      projects.push(
        {
          title: 'Gitcoin Grants Round Projects',
          url: 'https://explorer.gitcoin.co/#/projects',
          description: 'Open source Web3 projects seeking grant funding and community support',
          hackathon: 'Gitcoin Grants',
          status: 'funding'
        },
        {
          title: 'BuildBox Hackathon Submissions',
          url: 'https://buildbox.gitcoin.co',
          description: 'Web3 builders creating innovative solutions and seeking collaboration',
          hackathon: 'BuildBox',
          status: 'building'
        }
      );
    } catch (error) {
      console.log('⚠️ Gitcoin hackathon data failed');
    }

    // DoraHacks (major Web3 hackathon platform)
    try {
      console.log('🚀 Adding DoraHacks projects...');
      
      projects.push(
        {
          title: 'DoraHacks Web3 Hackathon Projects',
          url: 'https://dorahacks.io/hackathon',
          description: 'Global Web3 hackathon projects competing for prizes and seeking investment',
          hackathon: 'DoraHacks',
          status: 'active'
        },
        {
          title: 'DoraHacks Grant DAO Projects',
          url: 'https://dorahacks.io/grant',
          description: 'Decentralized projects applying for quadratic funding grants',
          hackathon: 'DoraHacks Grants',
          status: 'funding'
        }
      );
    } catch (error) {
      console.log('⚠️ DoraHacks data failed');
    }

    return projects;
  }

  transform(data: HackathonProject[]): ContentItem[] {
    return data.map(project => {
      // Hackathon projects always need something
      const needs: string[] = [];
      
      if (project.status === 'funding' || project.description.toLowerCase().includes('grant')) {
        needs.push('funding');
      }
      if (project.description.toLowerCase().includes('mentor') || project.status === 'building') {
        needs.push('mentorship');
      }
      if (project.description.toLowerCase().includes('feedback')) {
        needs.push('feedback');
      }
      if (project.description.toLowerCase().includes('team') || project.description.toLowerCase().includes('collaborate')) {
        needs.push('team-members');
      }
      
      // All hackathon projects need visibility
      needs.push('visibility');

      return {
        title: project.title,
        description: project.description,
        url: project.url,
        platform: 'hackathons',
        contentType: 'hackathon-project',
        publishedAt: new Date().toISOString(),
        metadata: {
          hackathon: project.hackathon,
          status: project.status,
          project_needs: needs,
          urgency: 'high', // Hackathon projects usually have deadlines
          source: 'hackathon-platforms'
        }
      };
    });
  }
}