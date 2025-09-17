import type { Database } from '../types/supabase';
import { supabase } from '../lib/supabase-client';
/**
 * API Key Service
 * Manages API keys from database and provides them to fetchers
 */





interface ApiKey {
  service_name: string;
  key_name: string;
  encrypted_key: string;
  is_active: boolean;
}

class ApiKeyService {
  private keys: Map<string, string> = new Map();
  private initialized = false;

  /**
   * Initialize by loading keys from database
   */
  async initialize(): Promise<void> {
    if (this.initialized) {return;}

    try {
      const { data, error } = await supabase
        .from('api_keys')
        .select('*')
        .eq('is_active', true);

      if (error) {
        console.error('Failed to load API keys:', error);
        return;
      }

      // Store keys in memory
      for (const key of data || []) {
        this.keys.set(key.service_name, key.encrypted_key);
      }

      // Also check environment variables as fallback
      if (process.env.GITHUB_TOKEN) {
        this.keys.set('github', process.env.GITHUB_TOKEN);
      }
      if (process.env.OPENAI_API_KEY) {
        this.keys.set('openai', process.env.OPENAI_API_KEY);
      }
      if (process.env.PRODUCTHUNT_TOKEN) {
        this.keys.set('producthunt', process.env.PRODUCTHUNT_TOKEN);
      }

      this.initialized = true;
      console.log(`✅ Loaded ${this.keys.size} API keys`);
    } catch (error) {
      console.error('Error initializing API keys:', error);
    }
  }

  /**
   * Get API key for a service
   */
  getKey(service: string): string | undefined {
    // Ensure we're initialized
    if (!this.initialized) {
      console.warn('API Key Service not initialized, using env vars only');
      
      // Try environment variables as fallback
      switch(service.toLowerCase()) {
        case 'github':
          return process.env.GITHUB_TOKEN;
        case 'openai':
          return process.env.OPENAI_API_KEY;
        case 'producthunt':
          return process.env.PRODUCTHUNT_TOKEN;
        default:
          return undefined;
      }
    }

    return this.keys.get(service.toLowerCase());
  }

  /**
   * Check if a service has an API key configured
   */
  hasKey(service: string): boolean {
    return this.keys.has(service.toLowerCase()) || 
           (service === 'github' && !!process.env.GITHUB_TOKEN) ||
           (service === 'openai' && !!process.env.OPENAI_API_KEY);
  }

  /**
   * Get all configured services
   */
  getConfiguredServices(): string[] {
    return Array.from(this.keys.keys());
  }

  /**
   * Update keys from database (for real-time updates)
   */
  async refresh(): Promise<void> {
    this.initialized = false;
    this.keys.clear();
    await this.initialize();
  }
}

// Export singleton
export const apiKeyService = new ApiKeyService();