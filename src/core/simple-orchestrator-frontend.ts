// Frontend-safe stub for orchestrator
export const orchestrator = {
  async discoverAndEnrich() {
    console.warn('Discovery requires backend');
    return { discovered: 0, enriched: 0 };
  },
  
  async runFullPipeline() {
    console.warn('Pipeline requires backend');
    return { success: false, message: 'Backend required' };
  }
};