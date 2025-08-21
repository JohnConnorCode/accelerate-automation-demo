const http = require('http');
const { parse } = require('url');

// Import our API handlers
const healthHandler = require('./api/health').default;
const fetchContentHandler = require('./api/cron/fetch-content').default;
const queueHandler = require('./api/admin/queue').default;

const server = http.createServer(async (req, res) => {
  const { pathname } = parse(req.url);
  
  // Mock Vercel request/response objects
  const mockReq = {
    ...req,
    query: {},
    body: {},
    headers: req.headers
  };
  
  const mockRes = {
    status: (code) => ({
      json: (data) => {
        res.writeHead(code, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
      },
      end: () => res.end()
    }),
    setHeader: (key, value) => res.setHeader(key, value)
  };
  
  console.log(`${req.method} ${pathname}`);
  
  try {
    switch (pathname) {
      case '/api/health':
        await healthHandler(mockReq, mockRes);
        break;
      case '/api/admin/queue':
        await queueHandler(mockReq, mockRes);
        break;
      case '/api/cron/fetch-content':
        mockReq.headers.authorization = 'Bearer test-secret-12345';
        await fetchContentHandler(mockReq, mockRes);
        break;
      default:
        res.writeHead(404);
        res.end('Not found');
    }
  } catch (error) {
    console.error('Error:', error);
    res.writeHead(500);
    res.end(JSON.stringify({ error: error.message }));
  }
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Test server running at http://localhost:${PORT}`);
  console.log('Available endpoints:');
  console.log('  GET http://localhost:3001/api/health');
  console.log('  GET http://localhost:3001/api/admin/queue');
  console.log('  POST http://localhost:3001/api/cron/fetch-content');
});