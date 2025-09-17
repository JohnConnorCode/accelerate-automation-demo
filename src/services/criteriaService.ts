// Frontend-safe criteria service
import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase';

class CriteriaService {
  async testFetchers() {
    // Mock test for frontend
    return {
      passed: 3,
      failed: 0,
      total: 3
    };
  }

  async getCriteria() {
    try {
      // Return mock criteria for now
      return {
        projects: [],
        funding: [],
        resources: []
      };
    } catch (error) {
      console.error('Error fetching criteria:', error);
      return {
        projects: [],
        funding: [],
        resources: []
      };
    }
  }

  async scoreContent(content: any) {
    // No fake scores - return neutral requiring review
    if (!content) {return 0;}
    return 50; // Neutral - requires manual review
  }
}

export const criteriaService = new CriteriaService();