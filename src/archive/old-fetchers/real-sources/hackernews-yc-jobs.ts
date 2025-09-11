/**
 * HackerNews YC Jobs Fetcher
 * Fetches REAL YC companies that are actively hiring
 * These are vetted, funded startups posting on HN Jobs
 */

import { z } from 'zod';
import { BaseFetcher, ContentItem, FetcherConfig } from '../../lib/base-fetcher';

const HNJobSchema = z.object({
  id: z.number(),
  by: z.string().optional(),
  score: z.number().optional(),
  time: z.number(),
  title: z.string(),
  type: z.string(),
  url: z.string().optional(),
  text: z.string().optional(),
});

type HNJob = z.infer<typeof HNJobSchema>;

export class HackerNewsYCJobsFetcher extends BaseFetcher<HNJob[]> {
  protected config: FetcherConfig = {
    name: 'HackerNews YC Jobs',
    url: 'https://hacker-news.firebaseio.com/v0/jobstories.json',
    headers: {},
    rateLimit: 500,
  };

  protected schema = z.array(HNJobSchema) as any;

  async fetch(): Promise<HNJob[][]> {
    try {
      // First get list of job IDs
      const jobIdsResponse = await fetch(this.config.url);
      if (!jobIdsResponse.ok) {
        console.error('Failed to fetch HN job IDs');
        return [];
      }

      const jobIds = await jobIdsResponse.json();
      
      // Fetch first 30 job details
      const jobs: HNJob[] = [];
      const idsToFetch = jobIds.slice(0, 30);
      
      for (const id of idsToFetch) {
        try {
          const jobResponse = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
          if (jobResponse.ok) {
            const job = await jobResponse.json();
            if (job && job.title) {
              jobs.push(job);
            }
          }
          // Rate limit
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`Error fetching job ${id}:`, error);
        }
      }
      
      return [jobs];
    } catch (error) {
      console.error('Error fetching HN jobs:', error);
      return [];
    }
  }

  transform(dataArrays: HNJob[][]): ContentItem[] {
    const items: ContentItem[] = [];
    
    for (const jobs of dataArrays) {
      for (const job of jobs) {
        // Only process YC company jobs
        const isYC = job.title?.includes('(YC') || 
                    job.url?.includes('ycombinator.com') ||
                    job.text?.includes('Y Combinator');
        
        if (!isYC) continue;
        
        // Extract YC batch from title
        const batchMatch = job.title?.match(/\(YC ([WS]\d{2})\)/);
        const batch = batchMatch?.[1] || '';
        
        // Parse company name
        const companyName = job.title
          ?.replace(/\(YC [WS]\d{2}\)/, '')
          ?.replace(/Is Hiring.*$/i, '')
          ?.trim() || 'Unknown YC Company';
        
        // Calculate year from batch
        const batchYear = batch ? parseInt('20' + batch.substring(1)) : 2024;
        const batchSeason = batch?.charAt(0);
        
        // ACCELERATE CRITERIA: Skip if before 2024
        if (batchYear < 2024) continue;
        
        // Extract position from title
        const positionMatch = job.title?.match(/Is Hiring[:\s–-]+(.+)$/i);
        const position = positionMatch?.[1]?.trim() || 'Multiple Positions';
        
        items.push({
          source: 'HackerNews Jobs',
          type: 'project',
          title: companyName,
          description: `${companyName} is hiring: ${position}. YC ${batch || 'Alumni'} company actively growing their team.`,
          url: job.url || `https://news.ycombinator.com/item?id=${job.id}`,
          author: job.by || 'YC Founder',
          author: job.by || 'YC Founder',
          tags: ['YC', batch, 'Hiring', 'Startup'].filter(Boolean),
          metadata: {
            // HN specific
            hn_id: job.id,
            hn_score: job.score || 1,
            hn_user: job.by,
            
            // YC specific
            yc_batch: batch,
            yc_year: batchYear,
            yc_season: batchSeason,
            is_yc_backed: true,
            
            // Job specific
            position_title: position,
            is_hiring: true,
            
            // ACCELERATE criteria
            launch_year: batchYear,
            launch_date: `${batchYear}-${batchSeason === 'W' ? '01' : '06'}-01`,
            
            // YC companies have at least $500k from YC
            funding_raised: 500000,
            funding_round: 'seed',
            has_institutional_backing: true,
            
            // Team size (hiring = growing team)
            team_size_estimate: '5-20',
            
            // Score for ACCELERATE
            // YC companies might be too advanced, but recent ones are good
            accelerate_score: Math.min(100,
              40 + // Base for YC company
              (batchYear === 2025 ? 30 : batchYear === 2024 ? 20 : 10) + // Recency
              20 + // Actively hiring = growth signal
              (job.score || 0) // HN engagement
            ),
            
            // Quality indicators
            is_verified: true,
            has_traction: true,
            credibility_score: 80,
          }
        });
      }
    }
    
    return items;
  }
}