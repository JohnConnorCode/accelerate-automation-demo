// Frontend-safe criteria service
import { supabase } from '../lib/supabase';

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
    // Mock scoring for frontend
    if (!content) return 0;
    return Math.floor(Math.random() * 40) + 60;
  }
}

export const criteriaService = new CriteriaService();