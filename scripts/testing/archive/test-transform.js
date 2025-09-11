// Quick test of the transformation
const { DataTransformer } = require('./dist/fetchers/data-transformer.js');

const rawItem = {
  title: "Test Project",
  url: "https://test.com",
  description: "A test project",
  score: 100
};

const transformed = DataTransformer.transformItem(rawItem, 'hackernews');
console.log(JSON.stringify(transformed, null, 2));