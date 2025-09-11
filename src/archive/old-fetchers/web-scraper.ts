/**
 * Web scraper for additional sources that don't have APIs
 * Uses ethical scraping practices with rate limiting
 */

export class WebScraper {
  private readonly userAgent = 'Mozilla/5.0 (compatible; AccelerateBot/1.0; +https://acceleratewith.us)';
  private readonly rateLimit = 1000; // 1 second between requests
  private lastRequestTime = 0;

  /**
   * Scrape with rate limiting
   */
  private async fetchWithRateLimit(url: string): Promise<string> {
    // Rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.rateLimit) {
      await new Promise(resolve => setTimeout(resolve, this.rateLimit - timeSinceLastRequest));
    }
    this.lastRequestTime = Date.now();

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Cache-Control': 'no-cache'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.text();
    } catch (error) {
      console.warn(`Failed to fetch ${url}:`, error);
      return '';
    }
  }

  /**
   * Scrape Web3 grant programs
   */
  async scrapeGrantPrograms(): Promise<any[]> {
    const grants = [];

    // 1. Gitcoin Grants (public page)
    try {
      const html = await this.fetchWithRateLimit('https://gitcoin.co/grants/explorer');
      // Extract grant data from HTML
      const grantMatches = html.match(/<div class="grant-card"[\s\S]*?<\/div>/g) || [];
      grants.push(...grantMatches.slice(0, 10).map(card => ({
        name: card.match(/title="([^"]+)"/)?.[1],
        description: card.match(/class="description">([^<]+)</)?.[1],
        amount: card.match(/\$([0-9,]+)/)?.[1],
        source: 'gitcoin',
        type: 'funding'
      })));
    } catch (error) {
      console.log('Gitcoin scraping failed:', error);
    }

    // 2. Ethereum Foundation Grants
    try {
      const html = await this.fetchWithRateLimit('https://ethereum.org/en/community/grants/');
      // Extract grant opportunities
      const programs = html.match(/<h3[^>]*>([^<]+)<\/h3>[\s\S]*?<p>([^<]+)<\/p>/g) || [];
      grants.push(...programs.slice(0, 5).map(program => ({
        name: program.match(/<h3[^>]*>([^<]+)/)?.[1],
        description: program.match(/<p>([^<]+)/)?.[1],
        source: 'ethereum-foundation',
        type: 'funding'
      })));
    } catch (error) {
      console.log('Ethereum Foundation scraping failed:', error);
    }

    // 3. Web3 Foundation Grants
    try {
      const html = await this.fetchWithRateLimit('https://web3.foundation/grants/');
      const grantInfo = html.match(/<article[\s\S]*?<\/article>/g) || [];
      grants.push(...grantInfo.slice(0, 5).map(info => ({
        name: info.match(/<h[23]>([^<]+)/)?.[1],
        description: info.match(/<p>([^<]+)/)?.[1],
        source: 'web3-foundation',
        type: 'funding'
      })));
    } catch (error) {
      console.log('Web3 Foundation scraping failed:', error);
    }

    return grants;
  }

  /**
   * Scrape startup accelerators
   */
  async scrapeAccelerators(): Promise<any[]> {
    const accelerators = [];

    // 1. Techstars
    try {
      const html = await this.fetchWithRateLimit('https://www.techstars.com/accelerators');
      const programs = html.match(/<div class="accelerator-card"[\s\S]*?<\/div>/g) || [];
      accelerators.push(...programs.slice(0, 10).map(prog => ({
        name: prog.match(/<h3>([^<]+)/)?.[1],
        location: prog.match(/location">([^<]+)/)?.[1],
        focus: prog.match(/focus">([^<]+)/)?.[1],
        source: 'techstars',
        type: 'funding'
      })));
    } catch (error) {
      console.log('Techstars scraping failed:', error);
    }

    // 2. 500 Startups
    try {
      const html = await this.fetchWithRateLimit('https://500.co/accelerators');
      const programs = html.match(/<div class="program"[\s\S]*?<\/div>/g) || [];
      accelerators.push(...programs.slice(0, 5).map(prog => ({
        name: prog.match(/<h4>([^<]+)/)?.[1],
        description: prog.match(/<p>([^<]+)/)?.[1],
        source: '500startups',
        type: 'funding'
      })));
    } catch (error) {
      console.log('500 Startups scraping failed:', error);
    }

    return accelerators;
  }

  /**
   * Scrape Web3 job boards for active projects
   */
  async scrapeWeb3Jobs(): Promise<any[]> {
    const projects = [];

    // 1. CryptoJobs
    try {
      const html = await this.fetchWithRateLimit('https://crypto.jobs/');
      const jobs = html.match(/<div class="job-listing"[\s\S]*?<\/div>/g) || [];
      
      // Extract unique companies that are hiring (indicates active projects)
      const companies = new Set<string>();
      jobs.forEach(job => {
        const company = job.match(/company">([^<]+)/)?.[1];
        if (company) companies.add(company);
      });
      
      projects.push(...Array.from(companies).slice(0, 20).map(company => ({
        name: company,
        description: 'Actively hiring in Web3 space',
        is_hiring: true,
        source: 'cryptojobs',
        type: 'project'
      })));
    } catch (error) {
      console.log('CryptoJobs scraping failed:', error);
    }

    // 2. AngelList/Wellfound Web3 Jobs
    try {
      const html = await this.fetchWithRateLimit('https://wellfound.com/jobs');
      const startups = html.match(/<div class="startup-header"[\s\S]*?<\/div>/g) || [];
      projects.push(...startups.slice(0, 15).map(startup => ({
        name: startup.match(/name">([^<]+)/)?.[1],
        tagline: startup.match(/tagline">([^<]+)/)?.[1],
        is_hiring: true,
        source: 'wellfound',
        type: 'project'
      })));
    } catch (error) {
      console.log('Wellfound scraping failed:', error);
    }

    return projects;
  }

  /**
   * Scrape educational resources
   */
  async scrapeEducationalResources(): Promise<any[]> {
    const resources = [];

    // 1. Ethereum.org tutorials
    try {
      const html = await this.fetchWithRateLimit('https://ethereum.org/en/developers/tutorials/');
      const tutorials = html.match(/<article[\s\S]*?<\/article>/g) || [];
      resources.push(...tutorials.slice(0, 10).map(tutorial => ({
        title: tutorial.match(/<h3>([^<]+)/)?.[1],
        description: tutorial.match(/<p>([^<]+)/)?.[1],
        url: tutorial.match(/href="([^"]+)"/)?.[1],
        source: 'ethereum.org',
        type: 'resource'
      })));
    } catch (error) {
      console.log('Ethereum.org scraping failed:', error);
    }

    // 2. ConsenSys Academy
    try {
      const html = await this.fetchWithRateLimit('https://consensys.net/academy/');
      const courses = html.match(/<div class="course"[\s\S]*?<\/div>/g) || [];
      resources.push(...courses.slice(0, 5).map(course => ({
        title: course.match(/title">([^<]+)/)?.[1],
        description: course.match(/description">([^<]+)/)?.[1],
        source: 'consensys',
        type: 'resource'
      })));
    } catch (error) {
      console.log('ConsenSys scraping failed:', error);
    }

    return resources;
  }

  /**
   * Scrape all sources
   */
  async scrapeAll(): Promise<{
    projects: any[];
    funding: any[];
    resources: any[];
  }> {
    console.log('🕷️ Starting web scraping (ethical, rate-limited)...');
    
    const [grants, accelerators, jobs, educational] = await Promise.all([
      this.scrapeGrantPrograms(),
      this.scrapeAccelerators(),
      this.scrapeWeb3Jobs(),
      this.scrapeEducationalResources()
    ]);

    const results = {
      projects: jobs,
      funding: [...grants, ...accelerators],
      resources: educational
    };

    console.log(`✅ Scraped: ${results.projects.length} projects, ${results.funding.length} funding, ${results.resources.length} resources`);
    
    return results;
  }
}

export const webScraper = new WebScraper();