// Frontend-safe orchestrator service
import { supabase } from '../lib/supabase';

class OrchestratorService {
  async discoverAndEnrich() {
    // Mock for frontend
    return {
      discovered: 5,
      enriched: 3
    };
  }

  async runFullPipeline() {
    // Mock for frontend
    return {
      success: true,
      message: 'Pipeline simulation complete'
    };
  }

  async getStatus() {
    // Mock status for frontend
    return {
      running: false,
      lastRun: new Date().toISOString(),
      itemsProcessed: 0
    };
  }
}

export const orchestratorService = new OrchestratorService();