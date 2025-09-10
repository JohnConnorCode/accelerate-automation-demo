// Simple test to check if fetchers exist
require('dotenv').config();

console.log('Testing fetcher imports...');

try {
  // Check if the module exists
  const earlyStage = require('./dist/fetchers/accelerate-specific/early-stage-projects');
  console.log('Early stage module:', Object.keys(earlyStage));
  
  const funding = require('./dist/fetchers/accelerate-specific/open-funding-opportunities');
  console.log('Funding module:', Object.keys(funding));
  
  const resources = require('./dist/fetchers/accelerate-specific/builder-resources');
  console.log('Resources module:', Object.keys(resources));
} catch (error) {
  console.error('Error loading modules:', error.message);
  console.log('\nTrying to compile TypeScript first...');
}