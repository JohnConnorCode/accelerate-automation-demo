import React, { useState } from 'react';

interface DataSource {
  name: string;
  status: 'active' | 'ready' | 'planned';
  url: string;
  description: string;
  dataType: string[];
  method: string;
  rateLimit: string;
  requiresAuth: boolean;
  icon: string;
}

export const DataSources: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'active' | 'ready' | 'planned'>('active');

  const dataSources: DataSource[] = [
    // Active Sources
    {
      name: 'GitHub',
      status: 'active',
      url: 'https://api.github.com/search/repositories',
      description: 'Open-source projects and repositories with 100+ stars. We fetch TypeScript projects sorted by recent updates.',
      dataType: ['Projects', 'Tools'],
      method: 'REST API',
      rateLimit: '30 req/min',
      requiresAuth: false,
      icon: '🐙'
    },
    {
      name: 'HackerNews',
      status: 'active',
      url: 'https://hn.algolia.com/api/v1/search',
      description: 'Top tech news, discussions, and product launches from the HN community.',
      dataType: ['Resources', 'News'],
      method: 'Algolia Search API',
      rateLimit: '30 req/min',
      requiresAuth: false,
      icon: '📰'
    },
    {
      name: 'ProductHunt',
      status: 'active',
      url: 'https://api.producthunt.com/v2/api/graphql',
      description: 'Daily product launches, new startups, and maker communities.',
      dataType: ['Projects', 'Startups'],
      method: 'GraphQL API',
      rateLimit: '30 req/min',
      requiresAuth: true,
      icon: '🚀'
    },
    {
      name: 'Dev.to',
      status: 'active',
      url: 'https://dev.to/api/articles',
      description: 'Developer tutorials, guides, and educational content tagged with webdev, javascript, and react.',
      dataType: ['Resources', 'Tutorials'],
      method: 'REST API',
      rateLimit: '30 req/min',
      requiresAuth: false,
      icon: '📚'
    },
    {
      name: 'DeFiLlama',
      status: 'active',
      url: 'https://api.llama.fi/protocols',
      description: 'DeFi protocols, TVL data, and blockchain project metrics.',
      dataType: ['Projects', 'Metrics'],
      method: 'REST API',
      rateLimit: '30 req/min',
      requiresAuth: false,
      icon: '🦙'
    },
    // Ready Sources
    {
      name: 'Gitcoin',
      status: 'ready',
      url: 'https://api.gitcoin.co/grants',
      description: 'Grant programs, quadratic funding rounds, and Web3 public goods funding.',
      dataType: ['Funding', 'Grants'],
      method: 'REST API',
      rateLimit: '60 req/min',
      requiresAuth: true,
      icon: '💰'
    },
    {
      name: 'AngelList/Wellfound',
      status: 'ready',
      url: 'https://api.angellist.com/startups',
      description: 'Early-stage startup data, founder profiles, and investment information.',
      dataType: ['Projects', 'Funding'],
      method: 'REST API',
      rateLimit: '100 req/min',
      requiresAuth: true,
      icon: '👼'
    },
    {
      name: 'Farcaster',
      status: 'ready',
      url: 'https://api.neynar.com/v2',
      description: 'Decentralized social protocol posts, builder updates, and community discussions.',
      dataType: ['Projects', 'Social'],
      method: 'REST API',
      rateLimit: '100 req/min',
      requiresAuth: true,
      icon: '🟣'
    },
    {
      name: 'Mirror.xyz',
      status: 'ready',
      url: 'https://mirror.xyz/api',
      description: 'Web3 publishing platform articles, project announcements, and thought leadership.',
      dataType: ['Resources', 'Content'],
      method: 'GraphQL API',
      rateLimit: '50 req/min',
      requiresAuth: false,
      icon: '✍️'
    },
    {
      name: 'Twitter/X',
      status: 'ready',
      url: 'https://api.twitter.com/2',
      description: 'Real-time project updates, founder tweets, and Web3 community discussions.',
      dataType: ['Projects', 'Social'],
      method: 'REST API v2',
      rateLimit: '300 req/15min',
      requiresAuth: true,
      icon: '🐦'
    },
    // Planned Sources
    {
      name: 'Crunchbase',
      status: 'planned',
      url: 'https://api.crunchbase.com',
      description: 'Comprehensive startup data, funding rounds, and investor information.',
      dataType: ['Projects', 'Funding'],
      method: 'REST API',
      rateLimit: 'Varies',
      requiresAuth: true,
      icon: '📊'
    },
    {
      name: 'Discord',
      status: 'planned',
      url: 'https://discord.com/api',
      description: 'Community metrics, engagement data, and project Discord servers.',
      dataType: ['Community', 'Metrics'],
      method: 'REST API',
      rateLimit: 'Varies',
      requiresAuth: true,
      icon: '💬'
    }
  ];

  const filteredSources = dataSources.filter(source => source.status === activeTab);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'ready': return 'bg-yellow-100 text-yellow-800';
      case 'planned': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Data Sources</h1>
        <p className="text-gray-600 max-w-3xl">
          Our content automation system collects data from multiple sources across the Web3 ecosystem. 
          Each source is carefully selected to provide high-quality, relevant content for early-stage builders.
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-3xl font-bold text-green-600">5</div>
          <div className="text-gray-600">Active Sources</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-3xl font-bold text-yellow-600">5</div>
          <div className="text-gray-600">Ready to Deploy</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-3xl font-bold text-blue-600">6 hrs</div>
          <div className="text-gray-600">Fetch Interval</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-3xl font-bold text-purple-600">30/min</div>
          <div className="text-gray-600">Rate Limit</div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('active')}
              className={`py-4 px-6 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'active'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className="mr-2">🟢</span>
              Active Sources
            </button>
            <button
              onClick={() => setActiveTab('ready')}
              className={`py-4 px-6 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'ready'
                  ? 'border-yellow-500 text-yellow-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className="mr-2">🟡</span>
              Ready to Deploy
            </button>
            <button
              onClick={() => setActiveTab('planned')}
              className={`py-4 px-6 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'planned'
                  ? 'border-gray-500 text-gray-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className="mr-2">⚪</span>
              Planned
            </button>
          </nav>
        </div>
      </div>

      {/* Data Sources Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {filteredSources.map((source) => (
          <div key={source.name} className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center">
                <span className="text-3xl mr-3">{source.icon}</span>
                <div>
                  <h3 className="text-xl font-semibold">{source.name}</h3>
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium mt-1 ${getStatusColor(source.status)}`}>
                    {source.status.toUpperCase()}
                  </span>
                </div>
              </div>
              {source.requiresAuth && (
                <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                  Auth Required
                </span>
              )}
            </div>

            <p className="text-gray-600 mb-4">{source.description}</p>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">API Endpoint:</span>
                <span className="font-mono text-xs text-gray-700 truncate max-w-xs">{source.url}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Method:</span>
                <span className="font-medium">{source.method}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Rate Limit:</span>
                <span className="font-medium">{source.rateLimit}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Data Types:</span>
                <div className="flex gap-1">
                  {source.dataType.map((type) => (
                    <span key={type} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                      {type}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Data Flow Section */}
      <div className="mt-12 bg-white rounded-lg shadow-lg p-8">
        <h2 className="text-2xl font-bold mb-6">Data Collection Pipeline</h2>
        
        <div className="flex items-center justify-between mb-8">
          {['Fetch', 'Normalize', 'Score', 'Enrich', 'Validate', 'Deduplicate', 'Store'].map((step, index) => (
            <div key={step} className="flex flex-col items-center">
              <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold mb-2">
                {index + 1}
              </div>
              <span className="text-sm font-medium">{step}</span>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <h3 className="font-semibold mb-3">How It Works</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• <strong>Fetch:</strong> Automated collection every 6 hours via cron jobs</li>
              <li>• <strong>Normalize:</strong> Convert to consistent format across all sources</li>
              <li>• <strong>Score:</strong> Basic scoring 0-100 based on relevance and quality</li>
              <li>• <strong>Enrich:</strong> Add GitHub data, social links, and AI analysis</li>
              <li>• <strong>Validate:</strong> Check against admin-defined criteria</li>
              <li>• <strong>Deduplicate:</strong> Hash comparison and fuzzy matching</li>
              <li>• <strong>Store:</strong> Save to content_curated table in Supabase</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-3">Enrichment Sources</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• <strong>GitHub API:</strong> Contributors, stars, languages, activity</li>
              <li>• <strong>Social Extraction:</strong> Twitter, LinkedIn, Discord links</li>
              <li>• <strong>AI Analysis:</strong> OpenAI GPT for comprehensive assessment</li>
              <li>• <strong>Metadata:</strong> Team size, funding info, tech stack</li>
              <li>• <strong>Validation:</strong> Quality score, completeness check</li>
              <li>• <strong>Classification:</strong> Project, Funding, or Resource</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Coverage by Content Type */}
      <div className="mt-8 bg-white rounded-lg shadow-lg p-8">
        <h2 className="text-2xl font-bold mb-6">Coverage by Content Type</h2>
        
        <div className="grid md:grid-cols-3 gap-6">
          <div className="border rounded-lg p-6">
            <h3 className="font-semibold text-lg mb-3">
              <span className="mr-2">🚀</span>Projects
            </h3>
            <p className="text-sm text-gray-600 mb-4">Early-stage startups, less than $500k funding</p>
            <div className="space-y-2">
              <div className="flex items-center text-sm">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                GitHub - Open source
              </div>
              <div className="flex items-center text-sm">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                ProductHunt - Launches
              </div>
              <div className="flex items-center text-sm">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                DeFiLlama - DeFi projects
              </div>
              <div className="flex items-center text-sm">
                <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                AngelList - Ready
              </div>
            </div>
          </div>

          <div className="border rounded-lg p-6">
            <h3 className="font-semibold text-lg mb-3">
              <span className="mr-2">💰</span>Funding
            </h3>
            <p className="text-sm text-gray-600 mb-4">Grants, accelerators, VCs</p>
            <div className="space-y-2">
              <div className="flex items-center text-sm">
                <span className="w-2 h-2 bg-orange-500 rounded-full mr-2"></span>
                Limited coverage
              </div>
              <div className="flex items-center text-sm">
                <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                Gitcoin - Ready
              </div>
              <div className="flex items-center text-sm">
                <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                Web3 Grants - Ready
              </div>
              <div className="flex items-center text-sm">
                <span className="w-2 h-2 bg-gray-500 rounded-full mr-2"></span>
                Chain-specific - Planned
              </div>
            </div>
          </div>

          <div className="border rounded-lg p-6">
            <h3 className="font-semibold text-lg mb-3">
              <span className="mr-2">📚</span>Resources
            </h3>
            <p className="text-sm text-gray-600 mb-4">Tools, guides, education</p>
            <div className="space-y-2">
              <div className="flex items-center text-sm">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                Dev.to - Tutorials
              </div>
              <div className="flex items-center text-sm">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                HackerNews - Content
              </div>
              <div className="flex items-center text-sm">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                GitHub - Tools
              </div>
              <div className="flex items-center text-sm">
                <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                Mirror.xyz - Ready
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* API Keys Status */}
      <div className="mt-8 bg-white rounded-lg shadow-lg p-8">
        <h2 className="text-2xl font-bold mb-6">API Key Requirements</h2>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold mb-3 text-green-600">✅ Configured</h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                GitHub API (optional, increases rate limit)
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                OpenAI API (via Supabase Edge Function)
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                Supabase (database and auth)
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-3 text-yellow-600">⚠️ Needed for Full Coverage</h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center">
                <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                ProductHunt Token
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                Twitter/X API v2
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                Farcaster/Neynar API
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                Discord Bot Token
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};