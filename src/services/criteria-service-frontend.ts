// Frontend-safe stub for criteria service
export const criteriaService = {
  async testFetchers() {
    console.warn('Fetcher testing requires backend');
    return { passed: 0, failed: 0, total: 0 };
  },
  
  async getCriteria() {
    return {
      projects: [],
      funding: [],
      resources: []
    };
  }
};