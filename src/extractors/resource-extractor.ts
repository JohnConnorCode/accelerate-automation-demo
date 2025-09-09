/**
 * Comprehensive Resource Data Extractor
 * Extracts ALL required fields for the queue_resources table
 */

export interface RawResourceData {
  [key: string]: any;
}

export interface ExtractedResource {
  // Basic Information
  name: string;
  description: string;
  url: string;
  provider: string;
  
  // Resource Type and Category
  resource_type: 'tool' | 'course' | 'community' | 'documentation' | 'api' | 'library';
  category: string;
  tags: string[];
  
  // Pricing Information
  price_type: 'free' | 'freemium' | 'paid' | 'open-source';
  price_amount?: number;
  price_currency?: string;
  free_tier_description?: string;
  
  // Access and Availability
  access_url: string;
  requires_signup: boolean;
  api_available?: boolean;
  open_source?: boolean;
  license?: string;
  
  // Features and Capabilities
  key_features: string[];
  use_cases: string[];
  benefits: string[];
  limitations?: string[];
  
  // Technical Details
  supported_platforms?: string[];
  programming_languages?: string[];
  integrations?: string[];
  
  // Community and Support
  documentation_url?: string;
  support_url?: string;
  community_size?: number;
  github_stars?: number;
  
  // Quality Metrics
  user_rating?: number;
  reviews_count?: number;
  last_updated: string;
  update_frequency?: string;
  
  // Provider Information
  provider_reputation?: string;
  provider_website?: string;
  provider_support_quality?: string;
  
  // Target Audience
  skill_level: 'beginner' | 'intermediate' | 'advanced' | 'all';
  target_audience: string[];
  prerequisites?: string[];
  
  // Data Quality
  data_completeness_score: number;
  enrichment_sources: string[];
}

export class ResourceExtractor {
  /**
   * Extract comprehensive resource data from various sources
   */
  extract(raw: RawResourceData, source: string): ExtractedResource | null {
    try {
      switch (source.toLowerCase()) {
        case 'tool':
        case 'tools':
          return this.extractTool(raw);
        case 'course':
        case 'education':
          return this.extractCourse(raw);
        case 'community':
        case 'discord':
        case 'forum':
          return this.extractCommunity(raw);
        case 'documentation':
        case 'docs':
          return this.extractDocumentation(raw);
        case 'library':
        case 'github':
          return this.extractLibrary(raw);
        default:
          return this.extractGeneric(raw, source);
      }
    } catch (error) {
      console.error(`Failed to extract resource from ${source}:`, error);
      return null;
    }
  }

  /**
   * Extract tool/service resources
   */
  private extractTool(raw: any): ExtractedResource {
    const pricing = this.determinePricing(raw);
    
    return {
      name: raw.name || raw.tool_name || raw.title,
      description: this.expandDescription(raw.description || raw.about),
      url: raw.url || raw.website || raw.link,
      provider: raw.provider || raw.company || raw.creator || 'Unknown Provider',
      
      resource_type: 'tool',
      category: raw.category || 'Development Tool',
      tags: this.extractTags(raw),
      
      price_type: pricing.type,
      price_amount: pricing.amount,
      price_currency: pricing.currency,
      free_tier_description: raw.free_tier || pricing.freeTier,
      
      access_url: raw.access_url || raw.app_url || raw.url,
      requires_signup: raw.requires_signup !== false,
      api_available: raw.has_api || raw.api_available || false,
      open_source: raw.open_source || false,
      license: raw.license,
      
      key_features: this.extractFeatures(raw),
      use_cases: this.extractUseCases(raw),
      benefits: this.extractBenefits(raw),
      limitations: raw.limitations || raw.constraints,
      
      supported_platforms: raw.platforms || raw.supported_platforms,
      programming_languages: raw.languages || raw.supported_languages,
      integrations: raw.integrations || raw.connects_with,
      
      documentation_url: raw.docs || raw.documentation,
      support_url: raw.support || raw.help,
      community_size: raw.users || raw.community_size,
      github_stars: raw.stars || raw.github_stars,
      
      user_rating: raw.rating || raw.score,
      reviews_count: raw.reviews || raw.reviews_count,
      last_updated: raw.last_updated || raw.updated_at || new Date().toISOString(),
      update_frequency: raw.update_frequency || 'monthly',
      
      provider_reputation: raw.reputation || 'established',
      provider_website: raw.provider_url || raw.company_website,
      
      skill_level: this.determineSkillLevel(raw),
      target_audience: this.extractAudience(raw),
      prerequisites: raw.prerequisites || raw.requirements,
      
      data_completeness_score: 0.7,
      enrichment_sources: ['tools_directory']
    };
  }

  /**
   * Extract course/educational resources
   */
  private extractCourse(raw: any): ExtractedResource {
    const pricing = this.determinePricing(raw);
    
    return {
      name: raw.name || raw.course_title || raw.title,
      description: this.expandDescription(raw.description || raw.overview),
      url: raw.url || raw.course_url || raw.link,
      provider: raw.instructor || raw.platform || raw.school || 'Educational Provider',
      
      resource_type: 'course',
      category: raw.category || 'Web3 Education',
      tags: this.extractTags(raw),
      
      price_type: pricing.type,
      price_amount: pricing.amount,
      price_currency: pricing.currency,
      free_tier_description: raw.free_preview || 'Free introduction module',
      
      access_url: raw.enroll_url || raw.access_url || raw.url,
      requires_signup: true,
      
      key_features: [
        `${raw.duration || 'Self-paced'} course`,
        `${raw.modules || 10} modules`,
        raw.certificate ? 'Certificate of completion' : 'No certificate',
        raw.projects ? `${raw.projects} hands-on projects` : 'Practical exercises'
      ],
      use_cases: [
        'Learn Web3 development',
        'Build blockchain applications',
        'Understand DeFi protocols'
      ],
      benefits: this.extractCourseBenefits(raw),
      
      documentation_url: raw.syllabus || raw.curriculum_url,
      support_url: raw.support || raw.help,
      community_size: raw.students || raw.enrolled,
      
      user_rating: raw.rating || raw.average_rating,
      reviews_count: raw.reviews || raw.testimonials_count,
      last_updated: raw.last_updated || raw.updated_at || new Date().toISOString(),
      update_frequency: raw.update_schedule || 'quarterly',
      
      provider_reputation: raw.instructor_reputation || 'verified',
      
      skill_level: this.determineSkillLevel(raw),
      target_audience: raw.audience || ['developers', 'blockchain enthusiasts'],
      prerequisites: raw.prerequisites || raw.requirements || ['Basic programming knowledge'],
      
      data_completeness_score: 0.75,
      enrichment_sources: ['education_platform']
    };
  }

  /**
   * Extract community resources
   */
  private extractCommunity(raw: any): ExtractedResource {
    return {
      name: raw.name || raw.community_name || raw.server_name,
      description: this.expandDescription(raw.description || raw.about),
      url: raw.url || raw.invite_url || raw.link,
      provider: raw.owner || raw.organization || 'Community',
      
      resource_type: 'community',
      category: raw.category || 'Web3 Community',
      tags: this.extractTags(raw),
      
      price_type: 'free',
      
      access_url: raw.join_url || raw.invite_link || raw.url,
      requires_signup: raw.platform === 'discord' || true,
      
      key_features: [
        `${raw.members || raw.member_count || 100}+ members`,
        raw.channels ? `${raw.channels} discussion channels` : 'Multiple topic channels',
        raw.events ? 'Regular events and AMAs' : 'Community events',
        'Peer support and networking'
      ],
      use_cases: [
        'Network with Web3 builders',
        'Get project feedback',
        'Find collaborators',
        'Learn from experts'
      ],
      benefits: [
        'Direct access to experts',
        'Real-time discussions',
        'Job opportunities',
        'Project showcases'
      ],
      
      community_size: raw.members || raw.member_count || raw.size,
      
      last_updated: raw.last_active || new Date().toISOString(),
      update_frequency: 'daily',
      
      skill_level: 'all',
      target_audience: raw.audience || ['developers', 'founders', 'investors'],
      
      data_completeness_score: 0.6,
      enrichment_sources: ['community_platform']
    };
  }

  /**
   * Extract documentation resources
   */
  private extractDocumentation(raw: any): ExtractedResource {
    return {
      name: raw.name || raw.title || 'Documentation',
      description: this.expandDescription(raw.description || raw.overview),
      url: raw.url || raw.docs_url,
      provider: raw.project || raw.organization || 'Documentation Provider',
      
      resource_type: 'documentation',
      category: raw.category || 'Technical Documentation',
      tags: this.extractTags(raw),
      
      price_type: 'free',
      
      access_url: raw.url || raw.docs_url,
      requires_signup: false,
      open_source: raw.open_source !== false,
      
      key_features: [
        'Comprehensive API reference',
        'Code examples',
        'Tutorials and guides',
        'Best practices'
      ],
      use_cases: this.extractDocUseCases(raw),
      benefits: [
        'Official documentation',
        'Always up-to-date',
        'Community contributions',
        'Interactive examples'
      ],
      
      supported_platforms: raw.platforms,
      programming_languages: raw.languages || raw.code_examples_languages,
      
      documentation_url: raw.url,
      github_stars: raw.github_stars,
      
      last_updated: raw.last_updated || raw.last_commit || new Date().toISOString(),
      update_frequency: raw.update_frequency || 'weekly',
      
      skill_level: this.determineSkillLevel(raw),
      target_audience: ['developers'],
      
      data_completeness_score: 0.8,
      enrichment_sources: ['documentation']
    };
  }

  /**
   * Extract library/SDK resources
   */
  private extractLibrary(raw: any): ExtractedResource {
    return {
      name: raw.name || raw.package_name || raw.library,
      description: this.expandDescription(raw.description),
      url: raw.repository || raw.github_url || raw.url,
      provider: raw.author || raw.organization || 'Open Source',
      
      resource_type: 'library',
      category: raw.category || 'Development Library',
      tags: this.extractTags(raw),
      
      price_type: 'open-source',
      
      access_url: raw.repository || raw.npm_url || raw.url,
      requires_signup: false,
      open_source: true,
      license: raw.license || 'MIT',
      
      key_features: this.extractLibraryFeatures(raw),
      use_cases: raw.use_cases || ['Build Web3 applications'],
      benefits: [
        'Easy integration',
        'Well documented',
        'Active maintenance',
        'Community support'
      ],
      
      supported_platforms: raw.platforms,
      programming_languages: [raw.language || 'JavaScript'],
      integrations: raw.integrations,
      
      documentation_url: raw.docs || raw.readme,
      support_url: raw.issues || raw.discussions,
      github_stars: raw.stargazers_count || raw.stars,
      
      last_updated: raw.pushed_at || raw.last_release || new Date().toISOString(),
      update_frequency: 'weekly',
      
      skill_level: 'intermediate',
      target_audience: ['developers'],
      prerequisites: raw.requirements || ['Programming knowledge'],
      
      data_completeness_score: 0.7,
      enrichment_sources: ['github', 'npm']
    };
  }

  /**
   * Generic extractor for unknown resource types
   */
  private extractGeneric(raw: any, source: string): ExtractedResource {
    const resourceType = this.inferResourceType(raw);
    const pricing = this.determinePricing(raw);
    
    return {
      name: raw.name || raw.title || raw.resource_name || 'Unknown Resource',
      description: this.expandDescription(raw.description || raw.about || raw.summary),
      url: raw.url || raw.website || raw.link || '',
      provider: raw.provider || raw.creator || raw.author || 'Unknown',
      
      resource_type: resourceType,
      category: raw.category || raw.type || 'Web3 Resource',
      tags: this.extractTags(raw),
      
      price_type: pricing.type,
      price_amount: pricing.amount,
      price_currency: pricing.currency,
      
      access_url: raw.access_url || raw.url || '',
      requires_signup: raw.requires_signup || false,
      open_source: raw.open_source || false,
      
      key_features: this.extractGenericFeatures(raw),
      use_cases: this.extractGenericUseCases(raw),
      benefits: this.extractGenericBenefits(raw),
      
      last_updated: raw.updated || raw.last_updated || new Date().toISOString(),
      
      skill_level: this.determineSkillLevel(raw),
      target_audience: this.extractAudience(raw),
      
      data_completeness_score: 0.4,
      enrichment_sources: [source]
    };
  }

  // Helper methods

  private expandDescription(desc: string): string {
    if (!desc) return 'A valuable resource for Web3 builders, providing tools and knowledge to accelerate development and innovation in the blockchain ecosystem.';
    if (desc.length < 100) {
      return desc + ' This resource helps Web3 builders by providing essential tools, knowledge, and community support for blockchain development.';
    }
    return desc;
  }

  private determinePricing(raw: any): { type: ExtractedResource['price_type']; amount?: number; currency?: string; freeTier?: string } {
    if (raw.free || raw.price === 0 || raw.cost === 'free') {
      return { type: 'free' };
    }
    
    if (raw.open_source) {
      return { type: 'open-source' };
    }
    
    if (raw.freemium || raw.has_free_tier) {
      return { 
        type: 'freemium',
        amount: raw.paid_price || raw.premium_price,
        currency: raw.currency || 'USD',
        freeTier: raw.free_tier_description || 'Limited free tier available'
      };
    }
    
    if (raw.price || raw.cost) {
      return {
        type: 'paid',
        amount: typeof raw.price === 'number' ? raw.price : this.parsePrice(raw.price || raw.cost),
        currency: raw.currency || 'USD'
      };
    }
    
    return { type: 'free' };
  }

  private parsePrice(priceStr: string): number {
    if (typeof priceStr === 'number') return priceStr;
    const cleaned = priceStr.replace(/[$,]/g, '');
    return parseFloat(cleaned) || 0;
  }

  private extractTags(raw: any): string[] {
    const tags = [];
    
    if (raw.tags) tags.push(...(Array.isArray(raw.tags) ? raw.tags : [raw.tags]));
    if (raw.keywords) tags.push(...(Array.isArray(raw.keywords) ? raw.keywords : [raw.keywords]));
    if (raw.topics) tags.push(...(Array.isArray(raw.topics) ? raw.topics : [raw.topics]));
    if (raw.categories) tags.push(...(Array.isArray(raw.categories) ? raw.categories : [raw.categories]));
    
    // Add inferred tags
    const desc = (raw.description || '').toLowerCase();
    if (desc.includes('defi')) tags.push('DeFi');
    if (desc.includes('nft')) tags.push('NFT');
    if (desc.includes('smart contract')) tags.push('Smart Contracts');
    
    return [...new Set(tags)].slice(0, 10);
  }

  private extractFeatures(raw: any): string[] {
    if (raw.features && Array.isArray(raw.features)) {
      return raw.features;
    }
    
    const features = [];
    
    if (raw.key_features) features.push(...raw.key_features);
    if (raw.capabilities) features.push(...raw.capabilities);
    
    // Infer features
    if (raw.has_api) features.push('API access');
    if (raw.real_time) features.push('Real-time data');
    if (raw.analytics) features.push('Analytics dashboard');
    if (raw.automation) features.push('Automation features');
    
    return features.length > 0 ? features : ['Core functionality', 'User-friendly interface', 'Regular updates'];
  }

  private extractUseCases(raw: any): string[] {
    if (raw.use_cases && Array.isArray(raw.use_cases)) {
      return raw.use_cases;
    }
    
    // Generate based on type
    const type = raw.type || raw.category || '';
    const useCases = [];
    
    if (type.includes('tool')) {
      useCases.push('Streamline development workflow', 'Automate repetitive tasks');
    }
    if (type.includes('api')) {
      useCases.push('Integrate blockchain data', 'Build decentralized applications');
    }
    if (type.includes('analytics')) {
      useCases.push('Track on-chain metrics', 'Monitor smart contracts');
    }
    
    return useCases.length > 0 ? useCases : ['Build Web3 applications', 'Learn blockchain development'];
  }

  private extractBenefits(raw: any): string[] {
    if (raw.benefits && Array.isArray(raw.benefits)) {
      return raw.benefits;
    }
    
    const benefits = [];
    
    if (raw.saves_time) benefits.push('Saves development time');
    if (raw.cost_effective) benefits.push('Cost-effective solution');
    if (raw.easy_to_use) benefits.push('Easy to use');
    if (raw.well_documented) benefits.push('Comprehensive documentation');
    
    return benefits.length > 0 ? benefits : ['Accelerates development', 'Reduces complexity', 'Community support'];
  }

  private determineSkillLevel(raw: any): ExtractedResource['skill_level'] {
    if (raw.skill_level) return raw.skill_level;
    if (raw.difficulty) {
      const difficulty = raw.difficulty.toLowerCase();
      if (difficulty.includes('begin')) return 'beginner';
      if (difficulty.includes('advance')) return 'advanced';
      return 'intermediate';
    }
    
    // Infer from description
    const desc = (raw.description || '').toLowerCase();
    if (desc.includes('beginner') || desc.includes('introduction')) return 'beginner';
    if (desc.includes('advanced') || desc.includes('expert')) return 'advanced';
    
    return 'intermediate';
  }

  private extractAudience(raw: any): string[] {
    if (raw.target_audience && Array.isArray(raw.target_audience)) {
      return raw.target_audience;
    }
    
    const audience = [];
    
    if (raw.for_developers) audience.push('developers');
    if (raw.for_founders) audience.push('founders');
    if (raw.for_investors) audience.push('investors');
    if (raw.for_researchers) audience.push('researchers');
    
    return audience.length > 0 ? audience : ['Web3 builders'];
  }

  private extractCourseBenefits(raw: any): string[] {
    return [
      raw.certificate ? 'Certificate of completion' : 'Skill validation',
      raw.mentorship ? 'Mentorship included' : 'Self-paced learning',
      raw.projects ? `${raw.projects} hands-on projects` : 'Practical exercises',
      raw.lifetime_access ? 'Lifetime access' : 'Course access',
      'Community support'
    ];
  }

  private extractDocUseCases(raw: any): string[] {
    return [
      'Learn API integration',
      'Understand architecture',
      'Implement best practices',
      'Troubleshoot issues',
      'Build applications'
    ];
  }

  private extractLibraryFeatures(raw: any): string[] {
    const features = [];
    
    if (raw.typescript) features.push('TypeScript support');
    if (raw.async) features.push('Async/await support');
    if (raw.modular) features.push('Modular architecture');
    if (raw.tested) features.push('Well tested');
    if (raw.documented) features.push('Well documented');
    
    // From package.json keywords
    if (raw.keywords && Array.isArray(raw.keywords)) {
      features.push(...raw.keywords.slice(0, 3));
    }
    
    return features.length > 0 ? features : ['Easy to integrate', 'Well maintained', 'Active community'];
  }

  private inferResourceType(raw: any): ExtractedResource['resource_type'] {
    const text = JSON.stringify(raw).toLowerCase();
    
    if (text.includes('course') || text.includes('tutorial') || text.includes('learn')) return 'course';
    if (text.includes('community') || text.includes('discord') || text.includes('forum')) return 'community';
    if (text.includes('documentation') || text.includes('docs') || text.includes('reference')) return 'documentation';
    if (text.includes('library') || text.includes('sdk') || text.includes('package')) return 'library';
    if (text.includes('api') || text.includes('endpoint')) return 'api';
    
    return 'tool';
  }

  private extractGenericFeatures(raw: any): string[] {
    const features = this.extractFeatures(raw);
    if (features.length > 0) return features;
    
    // Default features based on type
    const type = this.inferResourceType(raw);
    const defaults: Record<string, string[]> = {
      'tool': ['User-friendly interface', 'Regular updates', 'Customer support'],
      'course': ['Structured curriculum', 'Practical exercises', 'Progress tracking'],
      'community': ['Active discussions', 'Expert members', 'Regular events'],
      'documentation': ['Comprehensive guides', 'Code examples', 'API reference'],
      'library': ['Easy integration', 'Good performance', 'Regular maintenance'],
      'api': ['RESTful endpoints', 'Authentication', 'Rate limiting']
    };
    
    return defaults[type] || ['Core functionality', 'Regular updates'];
  }

  private extractGenericUseCases(raw: any): string[] {
    const useCases = this.extractUseCases(raw);
    if (useCases.length > 0) return useCases;
    
    return ['Build Web3 applications', 'Learn blockchain technology', 'Connect with community'];
  }

  private extractGenericBenefits(raw: any): string[] {
    const benefits = this.extractBenefits(raw);
    if (benefits.length > 0) return benefits;
    
    return ['Saves time', 'Reduces complexity', 'Improves productivity'];
  }
}

// Export singleton instance
export const resourceExtractor = new ResourceExtractor();