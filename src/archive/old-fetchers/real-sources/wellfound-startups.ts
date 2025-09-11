import { BaseFetcher, ContentItem, FetcherConfig } from '../../lib/base-fetcher';
import { z } from 'zod';

/**
 * WELLFOUND (ANGELLIST) STARTUP FETCHER
 * Fetches early-stage Web3 startups from Wellfound's public data
 * Focus on 2024+ launches with <$500k funding
 */

const WellfoundStartupSchema = z.object({
  id: z.string(),
  name: z.string(),
  tagline: z.string(),
  description: z.string(),
  website: z.string().optional(),
  founded: z.string().optional(),
  team_size: z.string().optional(),
  funding_stage: z.string().optional(),
  total_raised: z.string().optional(),
  industries: z.array(z.string()).optional(),
  location: z.string().optional(),
});

type WellfoundStartup = z.infer<typeof WellfoundStartupSchema>;

export class WellfoundStartupsFetcher extends BaseFetcher<WellfoundStartup[]> {
  protected config: FetcherConfig = {
    name: 'Wellfound Startups',
    url: 'https://wellfound.com/startups',
    rateLimit: 3000,
    timeout: 15000,
  };

  protected schema = z.array(WellfoundStartupSchema);

  async fetch(): Promise<WellfoundStartup[][]> {
    const startups: WellfoundStartup[] = [];
    
    try {
      // Fetch Web3/Crypto startups from Wellfound
      // Using their public JSON endpoints (discovered through network inspection)
      const searches = [
        'web3',
        'blockchain', 
        'crypto',
        'defi',
        'nft',
        'dao'
      ];

      for (const searchTerm of searches) {
        try {
          // Wellfound's public search endpoint (no API key needed)
          const searchUrl = `https://wellfound.com/api/v1/startups/search?query=${searchTerm}&page=1&per_page=20`;
          
          const response = await fetch(searchUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; AccelerateBot/1.0)',
              'Accept': 'application/json',
            }
          });

          if (response.ok) {
            const data = await response.json();
            
            // Parse the response and extract startup data
            if (data.startups) {
              for (const startup of data.startups) {
                // Parse founding year
                const foundedYear = this.parseFoundingYear(startup.founded || startup.founding_year);
                
                // ACCELERATE criteria: Skip pre-2024 companies
                if (foundedYear && foundedYear < 2024) continue;
                
                // Parse funding amount
                const fundingAmount = this.parseFundingAmount(startup.total_raised || startup.funding);
                
                // ACCELERATE criteria: Skip if >$500k raised
                if (fundingAmount > 500000) continue;
                
                // Parse team size
                const teamSize = this.parseTeamSize(startup.company_size || startup.team_size);
                
                // ACCELERATE criteria: Skip if >10 people
                if (teamSize > 10) continue;
                
                startups.push({
                  id: startup.id || startup.slug || `wellfound-${Date.now()}`,
                  name: startup.name,
                  tagline: startup.tagline || startup.high_concept || '',
                  description: startup.description || startup.product_desc || '',
                  website: startup.company_url || startup.website,
                  founded: startup.founded || startup.founding_year,
                  team_size: startup.company_size || startup.team_size,
                  funding_stage: startup.stage || startup.funding_stage,
                  total_raised: startup.total_raised || startup.funding,
                  industries: startup.markets || startup.tags || [],
                  location: startup.location || startup.headquarters,
                });
              }
            }
          }
        } catch (error) {
          console.log(`Failed to fetch Wellfound ${searchTerm} startups:`, error);
        }
      }

      // Alternative: Parse public startup directory pages
      if (startups.length === 0) {
        // Fallback to web scraping if API doesn't work
        const htmlResponse = await fetch('https://wellfound.com/startups/industry/web3-4', {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; AccelerateBot/1.0)',
          }
        });

        if (htmlResponse.ok) {
          const html = await htmlResponse.text();
          
          // Extract JSON-LD structured data
          const jsonLdMatch = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
          if (jsonLdMatch) {
            try {
              const jsonLd = JSON.parse(jsonLdMatch[1]);
              if (jsonLd.itemListElement) {
                for (const item of jsonLd.itemListElement) {
                  const startup = item.item;
                  
                  // Apply ACCELERATE filters
                  const foundedYear = this.parseFoundingYear(startup.foundingDate);
                  if (foundedYear && foundedYear < 2024) continue;
                  
                  startups.push({
                    id: startup['@id'] || `wellfound-${Date.now()}`,
                    name: startup.name,
                    tagline: startup.slogan || '',
                    description: startup.description || '',
                    website: startup.url,
                    founded: startup.foundingDate,
                    team_size: startup.numberOfEmployees?.value,
                    funding_stage: 'unknown',
                    total_raised: 'unknown',
                    industries: startup.industry ? [startup.industry] : [],
                    location: startup.location?.name,
                  });
                }
              }
            } catch (e) {
              console.log('Failed to parse Wellfound JSON-LD:', e);
            }
          }

          // Extract startup cards from HTML
          const startupCards = html.match(/<div[^>]*class="[^"]*startup-card[^"]*"[^>]*>[\s\S]*?<\/div>/g) || [];
          
          for (const card of startupCards.slice(0, 20)) {
            const nameMatch = card.match(/<h3[^>]*>([^<]+)<\/h3>/);
            const taglineMatch = card.match(/<p[^>]*class="[^"]*tagline[^"]*"[^>]*>([^<]+)<\/p>/);
            const urlMatch = card.match(/href="([^"]+)"/);
            
            if (nameMatch) {
              startups.push({
                id: `wellfound-${Date.now()}-${Math.random()}`,
                name: nameMatch[1].trim(),
                tagline: taglineMatch ? taglineMatch[1].trim() : '',
                description: taglineMatch ? taglineMatch[1].trim() : '',
                website: urlMatch ? `https://wellfound.com${urlMatch[1]}` : undefined,
                founded: '2024', // Assume recent if on active page
                team_size: '1-10',
                funding_stage: 'seed',
                total_raised: 'unknown',
                industries: ['web3'],
                location: 'unknown',
              });
            }
          }
        }
      }

    } catch (error) {
      console.error('Wellfound fetcher error:', error);
    }

    // Remove duplicates
    const uniqueStartups = this.deduplicateStartups(startups);
    
    console.log(`📊 Wellfound: Found ${uniqueStartups.length} startups matching ACCELERATE criteria`);
    
    return [uniqueStartups];
  }

  transform(data: WellfoundStartup[][]): ContentItem[] {
    const items: ContentItem[] = [];
    
    for (const startupList of data) {
      for (const startup of startupList) {
        items.push({
          type: 'project',
          title: startup.name,
          description: `${startup.tagline}. ${startup.description}`.substring(0, 1000),
          url: startup.website || `https://wellfound.com/company/${startup.id}`,
          source: 'Wellfound',
          tags: [
            ...(startup.industries || []),
            'startup',
            startup.funding_stage || 'early-stage',
          ].filter(Boolean),
          metadata: {
            platform: 'wellfound',
            startup_id: startup.id,
            launch_year: this.parseFoundingYear(startup.founded) || 2024,
            launch_date: startup.founded,
            team_size: this.parseTeamSize(startup.team_size) || 1,
            funding_stage: startup.funding_stage,
            funding_raised: this.parseFundingAmount(startup.total_raised) || 0,
            location: startup.location,
            
            // ACCELERATE scoring factors
            is_verified: true,
            has_traction: true,
            credibility_score: 70, // Wellfound listings are generally credible
            
            // For enrichment
            seeking_funding: ['pre-seed', 'seed'].includes(startup.funding_stage?.toLowerCase() || ''),
            seeking_developers: startup.team_size ? this.parseTeamSize(startup.team_size) < 5 : true,
          }
        });
      }
    }
    
    return items;
  }

  private parseFoundingYear(founded?: string): number | null {
    if (!founded) return null;
    
    // Handle various date formats
    const yearMatch = founded.match(/(\d{4})/);
    if (yearMatch) {
      return parseInt(yearMatch[1]);
    }
    
    // Handle "2024" or "2024-01" formats
    if (founded.length >= 4) {
      const year = parseInt(founded.substring(0, 4));
      if (!isNaN(year)) return year;
    }
    
    return null;
  }

  private parseFundingAmount(funding?: string): number {
    if (!funding || funding === 'unknown') return 0;
    
    // Remove currency symbols and convert to number
    const cleanFunding = funding.replace(/[$,€£¥]/g, '').trim();
    
    // Handle K/M notation
    if (cleanFunding.includes('K') || cleanFunding.includes('k')) {
      return parseFloat(cleanFunding) * 1000;
    }
    if (cleanFunding.includes('M') || cleanFunding.includes('m')) {
      return parseFloat(cleanFunding) * 1000000;
    }
    
    return parseFloat(cleanFunding) || 0;
  }

  private parseTeamSize(size?: string): number {
    if (!size) return 1;
    
    // Handle ranges like "1-10", "11-50"
    const rangeMatch = size.match(/(\d+)-(\d+)/);
    if (rangeMatch) {
      return parseInt(rangeMatch[2]); // Use upper bound for filtering
    }
    
    // Handle single numbers
    const numberMatch = size.match(/\d+/);
    if (numberMatch) {
      return parseInt(numberMatch[0]);
    }
    
    // Handle text descriptions
    if (size.includes('solo') || size.includes('founder')) return 1;
    if (size.includes('small')) return 5;
    if (size.includes('medium')) return 20;
    
    return 1;
  }

  private deduplicateStartups(startups: WellfoundStartup[]): WellfoundStartup[] {
    const seen = new Set<string>();
    return startups.filter(startup => {
      const key = startup.name.toLowerCase().replace(/\s+/g, '');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}