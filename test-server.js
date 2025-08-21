const express = require('express');
const app = express();
const port = 3000;

// Import API handlers
const healthHandler = require('./api/health.js');
const runHandler = require('./api/run.js');
const statusHandler = require('./api/status.js');

// Middleware
app.use(express.json());

// API routes
app.get('/api/health', (req, res) => healthHandler(req, res));
app.post('/api/run', (req, res) => runHandler(req, res));
app.get('/api/status', (req, res) => statusHandler(req, res));

// Start server
app.listen(port, () => {
  console.log(`✅ Test server running at http://localhost:${port}`);
  console.log(`   Health check: http://localhost:${port}/api/health`);
  console.log(`   Run endpoint: POST http://localhost:${port}/api/run`);
  console.log(`   Status endpoint: http://localhost:${port}/api/status`);
});