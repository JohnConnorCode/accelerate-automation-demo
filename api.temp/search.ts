import { VercelRequest, VercelResponse } from '@vercel/node';
import { smartSearch } from '../src/services/smart-search-service';
import { rateLimiter } from '../src/services/rate-limiting-service';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Apply rate limiting
  const clientId = req.headers['x-forwarded-for'] as string || 'unknown';
  const rateLimit = await rateLimiter.checkLimit('/api/search', clientId);
  
  if (!rateLimit.allowed) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      retryAfter: rateLimit.retryAfter
    });
  }

  try {
    if (req.method === 'GET') {
      const { q, action, type, limit = 20, offset = 0 } = req.query;

      switch (action) {
        case 'autocomplete':
          // Get autocomplete suggestions
          if (!q) {
            return res.status(400).json({ error: 'Query parameter required' });
          }
          
          const suggestions = await smartSearch.autocomplete(
            q as string,
            parseInt(limit as string)
          );
          
          return res.status(200).json({ suggestions });

        case 'ui':
          // Return search UI
          return res.status(200).send(generateSearchUI());

        default:
          // Perform search
          if (!q) {
            return res.status(400).json({ error: 'Query parameter required' });
          }
          
          const searchResults = await smartSearch.search({
            query: q as string,
            filters: type ? { type: [type as any] } : undefined,
            limit: parseInt(limit as string),
            offset: parseInt(offset as string)
          });
          
          return res.status(200).json(searchResults);
      }
    }

    if (req.method === 'POST') {
      const { query, filters, options } = req.body;

      if (!query) {
        return res.status(400).json({ error: 'Query required' });
      }

      const results = await smartSearch.search({
        query,
        filters,
        ...options
      });

      // Track click if provided
      if (req.body.clickedResult) {
        smartSearch.trackClick(query, req.body.clickedResult);
      }

      return res.status(200).json(results);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('[Search API] Error:', error);
    return res.status(500).json({ 
      error: 'Search error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

function generateSearchUI(): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🔍 Smart Search - Accelerate Platform</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 900px;
            margin: 0 auto;
        }
        
        .search-header {
            text-align: center;
            color: white;
            margin-bottom: 40px;
        }
        
        .search-header h1 {
            font-size: 3em;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
        }
        
        .search-header p {
            font-size: 1.2em;
            opacity: 0.9;
        }
        
        .search-box {
            background: white;
            border-radius: 50px;
            padding: 10px 20px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            display: flex;
            align-items: center;
            margin-bottom: 20px;
            position: relative;
        }
        
        .search-input {
            flex: 1;
            border: none;
            outline: none;
            font-size: 1.2em;
            padding: 15px;
        }
        
        .search-button {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            border: none;
            border-radius: 50%;
            width: 50px;
            height: 50px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5em;
            transition: transform 0.3s;
        }
        
        .search-button:hover {
            transform: scale(1.1);
        }
        
        .autocomplete {
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: white;
            border-radius: 15px;
            margin-top: 10px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.1);
            max-height: 400px;
            overflow-y: auto;
            display: none;
            z-index: 1000;
        }
        
        .autocomplete.active {
            display: block;
        }
        
        .suggestion {
            padding: 15px 20px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 1px solid #f0f0f0;
            transition: background 0.2s;
        }
        
        .suggestion:hover {
            background: #f8f9fa;
        }
        
        .suggestion-text {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .suggestion-icon {
            font-size: 1.2em;
        }
        
        .suggestion-count {
            color: #999;
            font-size: 0.9em;
        }
        
        .filters {
            background: white;
            border-radius: 15px;
            padding: 20px;
            margin-bottom: 30px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        }
        
        .filter-chips {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
        }
        
        .filter-chip {
            padding: 8px 16px;
            border-radius: 20px;
            background: #f0f0f0;
            border: 2px solid transparent;
            cursor: pointer;
            transition: all 0.3s;
        }
        
        .filter-chip:hover {
            background: #e0e0e0;
        }
        
        .filter-chip.active {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            border-color: #667eea;
        }
        
        .shortcuts {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
            flex-wrap: wrap;
        }
        
        .shortcut {
            padding: 5px 12px;
            background: rgba(255,255,255,0.2);
            color: white;
            border-radius: 15px;
            cursor: pointer;
            font-size: 0.9em;
            transition: background 0.3s;
        }
        
        .shortcut:hover {
            background: rgba(255,255,255,0.3);
        }
        
        .results {
            background: white;
            border-radius: 15px;
            padding: 25px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        }
        
        .result-stats {
            color: #666;
            margin-bottom: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .result-item {
            padding: 20px;
            border-bottom: 1px solid #f0f0f0;
            cursor: pointer;
            transition: background 0.2s;
        }
        
        .result-item:hover {
            background: #f8f9fa;
        }
        
        .result-title {
            font-size: 1.2em;
            color: #667eea;
            margin-bottom: 8px;
            font-weight: 600;
        }
        
        .result-description {
            color: #666;
            line-height: 1.6;
            margin-bottom: 10px;
        }
        
        .result-meta {
            display: flex;
            gap: 20px;
            font-size: 0.9em;
            color: #999;
        }
        
        .result-badge {
            padding: 3px 8px;
            background: #f0f0f0;
            border-radius: 10px;
            font-size: 0.85em;
        }
        
        mark {
            background: #fff59d;
            padding: 2px 4px;
            border-radius: 3px;
        }
        
        .loading {
            text-align: center;
            padding: 40px;
            color: #999;
        }
        
        .spinner {
            border: 3px solid #f3f3f3;
            border-top: 3px solid #667eea;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        .empty-state {
            text-align: center;
            padding: 60px 20px;
            color: #999;
        }
        
        .empty-state-icon {
            font-size: 4em;
            margin-bottom: 20px;
        }
        
        @media (max-width: 768px) {
            .search-header h1 {
                font-size: 2em;
            }
            
            .filters {
                padding: 15px;
            }
            
            .filter-chips {
                gap: 5px;
            }
            
            .filter-chip {
                font-size: 0.9em;
                padding: 6px 12px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="search-header">
            <h1>🔍 Smart Search</h1>
            <p>Find projects, funding, and resources instantly</p>
        </div>
        
        <div class="shortcuts">
            <div class="shortcut" onclick="applyShortcut('new')">🆕 New this week</div>
            <div class="shortcut" onclick="applyShortcut('hot')">🔥 Trending</div>
            <div class="shortcut" onclick="applyShortcut('funded')">💰 Funding</div>
            <div class="shortcut" onclick="applyShortcut('ai')">🤖 AI/ML</div>
            <div class="shortcut" onclick="applyShortcut('web3')">⛓️ Web3</div>
            <div class="shortcut" onclick="applyShortcut('high-score')">⭐ High Score</div>
        </div>
        
        <div class="search-box">
            <input 
                type="text" 
                class="search-input" 
                id="searchInput"
                placeholder="Search for projects, funding, resources..."
                autocomplete="off"
            >
            <button class="search-button" onclick="performSearch()">
                🔍
            </button>
            
            <div class="autocomplete" id="autocomplete"></div>
        </div>
        
        <div class="filters">
            <div class="filter-chips">
                <div class="filter-chip" data-type="project" onclick="toggleFilter(this)">
                    📦 Projects
                </div>
                <div class="filter-chip" data-type="funding" onclick="toggleFilter(this)">
                    💰 Funding
                </div>
                <div class="filter-chip" data-type="resource" onclick="toggleFilter(this)">
                    📚 Resources
                </div>
                <div class="filter-chip" data-sort="relevance" onclick="toggleSort(this)">
                    🎯 Relevance
                </div>
                <div class="filter-chip" data-sort="date" onclick="toggleSort(this)">
                    📅 Latest
                </div>
                <div class="filter-chip" data-sort="score" onclick="toggleSort(this)">
                    ⭐ Top Rated
                </div>
            </div>
        </div>
        
        <div class="results" id="results">
            <div class="empty-state">
                <div class="empty-state-icon">🔍</div>
                <h3>Start searching</h3>
                <p>Type in the search box above or use shortcuts to explore</p>
            </div>
        </div>
    </div>
    
    <script>
        let currentFilters = {
            type: [],
            sortBy: 'relevance'
        };
        
        let searchTimeout;
        let currentQuery = '';
        
        // Initialize
        document.getElementById('searchInput').addEventListener('input', handleInput);
        document.getElementById('searchInput').addEventListener('keypress', handleKeypress);
        
        function handleInput(e) {
            const query = e.target.value;
            
            // Clear previous timeout
            clearTimeout(searchTimeout);
            
            if (query.length < 2) {
                hideAutocomplete();
                return;
            }
            
            // Debounce autocomplete
            searchTimeout = setTimeout(async () => {
                await showAutocomplete(query);
            }, 200);
        }
        
        function handleKeypress(e) {
            if (e.key === 'Enter') {
                performSearch();
            }
        }
        
        async function showAutocomplete(query) {
            try {
                const response = await fetch(\`/api/search?action=autocomplete&q=\${encodeURIComponent(query)}\`);
                const data = await response.json();
                
                const autocompleteEl = document.getElementById('autocomplete');
                
                if (data.suggestions && data.suggestions.length > 0) {
                    autocompleteEl.innerHTML = data.suggestions.map(suggestion => \`
                        <div class="suggestion" onclick="selectSuggestion('\${suggestion.text}')">
                            <div class="suggestion-text">
                                <span class="suggestion-icon">\${suggestion.icon || '🔍'}</span>
                                <span>\${suggestion.text}</span>
                            </div>
                            \${suggestion.count ? \`<span class="suggestion-count">\${suggestion.count} results</span>\` : ''}
                        </div>
                    \`).join('');
                    
                    autocompleteEl.classList.add('active');
                } else {
                    hideAutocomplete();
                }
            } catch (error) {
                console.error('Autocomplete error:', error);
            }
        }
        
        function hideAutocomplete() {
            document.getElementById('autocomplete').classList.remove('active');
        }
        
        function selectSuggestion(text) {
            document.getElementById('searchInput').value = text;
            hideAutocomplete();
            performSearch();
        }
        
        async function performSearch() {
            const query = document.getElementById('searchInput').value;
            
            if (!query) return;
            
            currentQuery = query;
            hideAutocomplete();
            
            // Show loading
            document.getElementById('results').innerHTML = \`
                <div class="loading">
                    <div class="spinner"></div>
                    <p>Searching...</p>
                </div>
            \`;
            
            try {
                const response = await fetch('/api/search', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        query,
                        filters: currentFilters.type.length > 0 ? { type: currentFilters.type } : undefined,
                        options: {
                            sortBy: currentFilters.sortBy,
                            limit: 20
                        }
                    })
                });
                
                const data = await response.json();
                displayResults(data);
            } catch (error) {
                console.error('Search error:', error);
                document.getElementById('results').innerHTML = \`
                    <div class="empty-state">
                        <div class="empty-state-icon">❌</div>
                        <h3>Search failed</h3>
                        <p>Please try again</p>
                    </div>
                \`;
            }
        }
        
        function displayResults(data) {
            const resultsEl = document.getElementById('results');
            
            if (!data.results || data.results.length === 0) {
                resultsEl.innerHTML = \`
                    <div class="empty-state">
                        <div class="empty-state-icon">🤷</div>
                        <h3>No results found</h3>
                        <p>Try different keywords or filters</p>
                    </div>
                \`;
                return;
            }
            
            let html = \`
                <div class="result-stats">
                    <span>Found \${data.totalCount} results in \${data.responseTime}ms</span>
                    <span>Showing 1-\${Math.min(20, data.totalCount)}</span>
                </div>
            \`;
            
            // Add suggestions if any
            if (data.suggestions && data.suggestions.length > 0) {
                html += \`
                    <div style="margin-bottom: 20px;">
                        <small style="color: #999;">Try also:</small>
                        <div style="display: flex; gap: 10px; margin-top: 5px;">
                            \${data.suggestions.slice(0, 3).map(s => 
                                \`<span class="filter-chip" onclick="selectSuggestion('\${s.text}')">\${s.text}</span>\`
                            ).join('')}
                        </div>
                    </div>
                \`;
            }
            
            // Add results
            data.results.forEach(result => {
                const title = result.highlights?.title || result.title;
                const description = result.highlights?.description || 
                                   (result.description.length > 200 
                                    ? result.description.substring(0, 200) + '...' 
                                    : result.description);
                
                html += \`
                    <div class="result-item" onclick="viewResult('\${result.id}')">
                        <div class="result-title">\${title}</div>
                        <div class="result-description">\${description}</div>
                        <div class="result-meta">
                            <span class="result-badge">\${result.type}</span>
                            <span>Score: \${result.score}</span>
                            <span>Relevance: \${result.relevance}</span>
                        </div>
                    </div>
                \`;
            });
            
            resultsEl.innerHTML = html;
        }
        
        function toggleFilter(chip) {
            const type = chip.dataset.type;
            chip.classList.toggle('active');
            
            if (chip.classList.contains('active')) {
                currentFilters.type.push(type);
            } else {
                currentFilters.type = currentFilters.type.filter(t => t !== type);
            }
            
            if (currentQuery) {
                performSearch();
            }
        }
        
        function toggleSort(chip) {
            // Remove active from all sort chips
            document.querySelectorAll('[data-sort]').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            
            currentFilters.sortBy = chip.dataset.sort;
            
            if (currentQuery) {
                performSearch();
            }
        }
        
        function applyShortcut(shortcut) {
            const input = document.getElementById('searchInput');
            
            switch(shortcut) {
                case 'new':
                    input.value = 'new';
                    break;
                case 'hot':
                    input.value = 'hot';
                    break;
                case 'funded':
                    input.value = 'type:funding';
                    break;
                case 'ai':
                    input.value = 'ai machine learning';
                    break;
                case 'web3':
                    input.value = 'web3 blockchain';
                    break;
                case 'high-score':
                    input.value = 'score:>80';
                    break;
            }
            
            performSearch();
        }
        
        function viewResult(id) {
            // Track click
            fetch('/api/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: currentQuery,
                    clickedResult: id
                })
            });
            
            // In a real app, this would navigate to the result
            console.log('View result:', id);
            alert('View result: ' + id);
        }
        
        // Focus search input on load
        document.getElementById('searchInput').focus();
    </script>
</body>
</html>
  `;
}