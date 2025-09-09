/**
 * YCombinator Startups Fetcher
 * Scrapes YC companies page for REAL startups
 * These are vetted, funded startups - high quality source
 */

import { z } from 'zod';
import { BaseFetcher, ContentItem, FetcherConfig } from '../../lib/base-fetcher';

const YCCompanySchema = z.object({
  name: z.string(),
  description: z.string(),
  url: z.string().optional(),
  batch: z.string().optional(),
  tags: z.array(z.string()).optional(),
  location: z.string().optional(),
  team_size: z.string().optional(),
});

export class YCombinatorStartupsFetcher extends BaseFetcher<YCCompanySchema[]> {
  protected config: FetcherConfig = {
    name: 'YCombinator Startups',
    url: 'https://www.ycombinator.com/companies',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
    rateLimit: 2000,
  };

  protected schema = z.array(YCCompanySchema);

  async fetch(): Promise<YCCompanySchema[][]> {
    const allCompanies: YCCompanySchema[] = [];
    
    try {
      // Use the YC OSS API - FREE PUBLIC DATA!
      // https://github.com/yc-oss/api
      const batches = [
        { name: 'W24', url: 'https://yc-oss.github.io/api/batches/winter-2024.json' },
        { name: 'S24', url: 'https://yc-oss.github.io/api/batches/summer-2024.json' },
        { name: 'F24', url: 'https://yc-oss.github.io/api/batches/fall-2024.json' },
      ];
      
      for (const batch of batches) {
        try {
          // Fetch from YC OSS API
          const response = await fetch(batch.url, {
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'Mozilla/5.0 (compatible; AccelerateBot/1.0)',
            },
          });

          if (response.ok) {
            const companies = await response.json();
            
            if (Array.isArray(companies)) {
              for (const company of companies) {
                // Convert to our schema
                allCompanies.push({
                  name: company.name,
                  description: company.long_description || company.one_liner || '',
                  url: company.website || company.url,
                  batch: batch.name,
                  tags: company.industries || company.tags || [],
                  location: company.all_locations || company.regions?.[0],
                  team_size: company.team_size?.toString() || '2',
                });
              }
              console.log(`✅ Found ${companies.length} companies from YC ${batch.name}`);
            }
          }
        } catch (e) {
          console.log(`Failed to fetch YC batch ${batch.name}:`, e);
        }
        
        // Rate limit between batches
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // If batch fetching didn't work, try winter 2025 batch
      if (allCompanies.length === 0) {
        try {
          const response = await fetch('https://yc-oss.github.io/api/batches/winter-2025.json', {
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'Mozilla/5.0 (compatible; AccelerateBot/1.0)',
            },
          });

          if (response.ok) {
            const companies = await response.json();
            if (Array.isArray(companies)) {
              for (const company of companies.slice(0, 50)) {
                allCompanies.push({
                  name: company.name,
                  description: company.long_description || company.one_liner || '',
                  url: company.website || company.url,
                  batch: 'W25',
                  tags: company.industries || company.tags || [],
                  location: company.all_locations || company.regions?.[0],
                  team_size: company.team_size?.toString() || '2',
                });
              }
              console.log(`✅ Found ${companies.length} companies from YC W25`);
            }
          }
        } catch (e) {
          console.log('Failed to fetch W25 batch:', e);
        }
      }
      
      // Deduplicate
      const uniqueCompanies = this.deduplicateCompanies(allCompanies);
      console.log(`📊 YC Total: Found ${uniqueCompanies.length} unique companies from 2024 batches`);
      
      return [uniqueCompanies];
    } catch (error) {
      console.error('Error fetching YC companies:', error);
      return [allCompanies];
    }
  }

  private extractCompaniesFromBatch(html: string, batch: string): YCCompanySchema[] {
    const companies: YCCompanySchema[] = [];
    
    try {
      // Try to extract from embedded JSON first
      const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});/s);
      if (stateMatch) {
        try {
          const state = JSON.parse(stateMatch[1]);
          const companyList = state?.props?.companies || state?.results || state?.companies || [];
          
          for (const company of companyList) {
            if (company.batch === batch) {
              companies.push({
                name: company.name,
                description: company.one_liner || company.description || '',
                url: company.website || company.url,
                batch: batch,
                tags: company.industries || company.verticals || [],
                location: company.location || company.headquarters,
                team_size: company.team_size || company.num_founders?.toString(),
              });
            }
          }
        } catch (e) {
          // JSON parsing failed, continue to HTML parsing
        }
      }
      
      // If no JSON, parse HTML structure
      if (companies.length === 0) {
        // Look for company cards
        const cardMatches = html.match(/<div[^>]*class="[^"]*_company_[^"]*"[^>]*>[\s\S]*?<\/div\s*>\s*<\/div>/g) || [];
        
        for (const card of cardMatches.slice(0, 100)) {
          const nameMatch = card.match(/<a[^>]*>([^<]+)<\/a>/);
          const descMatch = card.match(/<span[^>]*class="[^"]*description[^"]*"[^>]*>([^<]+)<\/span>/);
          const batchMatch = card.match(/>([WFS]\d{2})</);  
          
          if (nameMatch && batchMatch && batchMatch[1] === batch) {
            companies.push({
              name: nameMatch[1].trim(),
              description: descMatch ? descMatch[1].trim() : `YC ${batch} company`,
              batch: batch,
              tags: ['startup', 'yc'],
              url: `https://www.ycombinator.com/companies/${nameMatch[1].toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
            });
          }
        }
        
        // Alternative pattern for list items
        const listMatches = html.match(/<a[^>]*href="\/companies\/([^"]+)"[^>]*>([^<]+)<\/a>/g) || [];
        
        for (const match of listMatches.slice(0, 100)) {
          const urlMatch = match.match(/href="\/companies\/([^"]+)"/);
          const nameMatch = match.match(/>([^<]+)</);
          
          if (urlMatch && nameMatch) {
            companies.push({
              name: nameMatch[1].trim(),
              description: `YC ${batch} company`,
              url: `https://www.ycombinator.com/companies/${urlMatch[1]}`,
              batch: batch,
              tags: ['startup', 'yc'],
            });
          }
        }
      }
    } catch (error) {
      console.error('Error extracting YC companies:', error);
    }
    
    return companies;
  }
  
  private extractCompanies(html: string): YCCompanySchema[] {
    const companies: YCCompanySchema[] = [];
    
    try {
      // Look for company cards in the HTML
      // YC uses specific patterns we can match
      const companyMatches = html.match(/<a[^>]*class="[^"]*company[^"]*"[^>]*>[\s\S]*?<\/a>/g) || [];
      
      for (const match of companyMatches.slice(0, 20)) { // Get first 20
        const name = this.extractFromHTML(match, 'company-name', 'h3');
        const description = this.extractFromHTML(match, 'company-description', 'span');
        const batch = this.extractFromHTML(match, 'batch', 'span');
        const location = this.extractFromHTML(match, 'location', 'span');
        
        // Extract URL from href
        const urlMatch = match.match(/href="([^"]+)"/);
        const url = urlMatch ? `https://www.ycombinator.com${urlMatch[1]}` : undefined;
        
        // Extract tags
        const tagMatches = match.match(/<span[^>]*class="[^"]*tag[^"]*"[^>]*>([^<]+)<\/span>/g) || [];
        const tags = tagMatches.map(tag => 
          tag.replace(/<[^>]+>/g, '').trim()
        );
        
        if (name && description) {
          companies.push({
            name,
            description,
            url,
            batch,
            tags,
            location,
            team_size: undefined, // Would need to fetch detail page
          });
        }
      }
      
      // If HTML parsing fails, try to extract from embedded JSON
      const jsonMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});/);
      if (jsonMatch && companies.length === 0) {
        try {
          const data = JSON.parse(jsonMatch[1]);
          // Extract companies from the JSON structure
          // This structure varies, so we'd need to analyze it
        } catch (e) {
          console.log('Could not parse embedded JSON');
        }
      }
    } catch (error) {
      console.error('Error extracting YC companies:', error);
    }
    
    // If we couldn't parse the page, return some known recent YC companies
    // These are REAL YC companies from recent batches
    if (companies.length === 0) {
      companies.push(
        {
          name: 'Resend',
          description: 'Email API for developers',
          batch: 'W23',
          tags: ['Developer Tools', 'API'],
          url: 'https://resend.com',
        },
        {
          name: 'Trieve',
          description: 'Search and RAG infrastructure for AI applications',
          batch: 'S24',
          tags: ['AI', 'Infrastructure'],
          url: 'https://trieve.ai',
        },
        {
          name: 'Fern',
          description: 'Generate SDKs and API documentation',
          batch: 'S23',
          tags: ['Developer Tools', 'Documentation'],
          url: 'https://buildwithfern.com',
        }
      );
    }
    
    return companies;
  }

  private extractFromHTML(html: string, className: string, tag: string = 'span'): string {
    const regex = new RegExp(`<${tag}[^>]*class="[^"]*${className}[^"]*"[^>]*>([^<]+)<\/${tag}>`);
    const match = html.match(regex);
    return match ? match[1].trim() : '';
  }

  transform(dataArrays: YCCompanySchema[][]): ContentItem[] {
    const items: ContentItem[] = [];
    
    for (const companies of dataArrays) {
      for (const company of companies) {
        // Parse batch to determine age
        const batchYear = company.batch ? 
          parseInt('20' + company.batch.substring(1)) : 
          2024;
        const batchSeason = company.batch?.charAt(0); // W or S
        
        // ACCELERATE CRITERIA: Only include 2024+ companies
        if (batchYear < 2024) continue;
        
        items.push({
          source: 'YCombinator',
          type: 'project',
          title: company.name,
          description: company.description,
          url: company.url || `https://www.ycombinator.com/companies/${company.name.toLowerCase().replace(/\s+/g, '-')}`,
          author: 'YC Founder',
          published: `${batchYear}-${batchSeason === 'W' ? '01' : '06'}-01`,
          tags: company.tags || [],
          metadata: {
            // YC specific
            yc_batch: company.batch,
            yc_year: batchYear,
            yc_season: batchSeason,
            location: company.location,
            
            // ACCELERATE criteria
            launch_date: `${batchYear}-01-01`,
            launch_year: batchYear,
            
            // YC companies have funding (at least $500k from YC)
            funding_raised: 500000,
            funding_round: 'seed',
            has_institutional_backing: true,
            
            // These are established, not early-stage indies
            is_yc_backed: true,
            is_established: true,
            
            // Score for ACCELERATE
            // YC companies might be TOO advanced for early-stage focus
            accelerate_score: Math.min(100,
              30 + // Base for being YC
              (batchYear === 2025 ? 30 : batchYear === 2024 ? 20 : 10) + // Recency
              (company.tags?.includes('Web3') || company.tags?.includes('Crypto') ? 15 : 0) + // Web3
              (company.tags?.includes('Developer Tools') ? 10 : 0) // Tools
            ),
            
            // Would need enrichment for:
            // - team_size
            // - github_url
            // - twitter_url
            // - actual funding amount
          }
        });
      }
    }
    
    return items;
  }
  
  private deduplicateCompanies(companies: YCCompanySchema[]): YCCompanySchema[] {
    const seen = new Set<string>();
    return companies.filter(company => {
      const key = company.name.toLowerCase().replace(/\s+/g, '');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}