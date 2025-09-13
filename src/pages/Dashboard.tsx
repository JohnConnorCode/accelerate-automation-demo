import { useState, useEffect } from 'react';
import { 
  TrendingUp, Clock, CheckCircle, XCircle, Package, DollarSign, 
  BookOpen, Zap, AlertCircle, Plus, Play, Pause, RefreshCw,
  Globe, Twitter, Linkedin, Youtube, FileText, Send, Settings,
  BarChart3, Calendar, Filter, Search, Download, Upload
} from 'lucide-react';
import { supabase } from '../lib/supabase-client';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [isGenerating, setIsGenerating] = useState(false);
  const [contentQueue, setContentQueue] = useState<any[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['twitter', 'linkedin']);
  const [automationStatus, setAutomationStatus] = useState('paused');
  const [selectedContent, setSelectedContent] = useState<any>(null);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    avgScore: 0,
    todayGenerated: 0,
    weeklyGrowth: 0,
    platformStats: {
      twitter: 0,
      linkedin: 0,
      youtube: 0,
      blog: 0
    }
  });
  
  // Load real data from localStorage on mount
  useEffect(() => {
    const savedContent = localStorage.getItem('contentQueue');
    const savedStats = localStorage.getItem('dashboard_stats');
    if (savedContent) {
      const queue = JSON.parse(savedContent);
      setContentQueue(queue);
      updateStats(queue);
    }
    if (savedStats) {
      setStats(JSON.parse(savedStats));
    }
  }, []);
  
  // Update stats based on content queue
  const updateStats = (queue: any[]) => {
    const pending = queue.filter(c => c.status === 'pending').length;
    const approved = queue.filter(c => c.status === 'approved').length;
    const rejected = queue.filter(c => c.status === 'rejected').length;
    const today = new Date().toDateString();
    const todayGenerated = queue.filter(c => new Date(c.createdAt).toDateString() === today).length;
    
    const platformCounts = queue.reduce((acc, content) => {
      acc[content.platform] = (acc[content.platform] || 0) + 1;
      return acc;
    }, { twitter: 0, linkedin: 0, youtube: 0, blog: 0 });
    
    const scores = queue.map(c => c.score).filter(s => s);
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    
    const newStats = {
      total: queue.length,
      pending,
      approved,
      rejected,
      avgScore,
      todayGenerated,
      weeklyGrowth: 0, // Will calculate when we have historical data
      platformStats: platformCounts
    };
    setStats(newStats);
    // Save stats to localStorage
    localStorage.setItem('dashboard_stats', JSON.stringify(newStats));
  };

  const handleGenerateContent = async (contentType: 'projects' | 'funding' | 'resources' = 'projects') => {
    setIsGenerating(true);
    
    try {
      // Get project URL and anon key
      const projectUrl = supabase.supabaseUrl;
      const anonKey = supabase.supabaseKey;
      
      // Fetch latest Accelerate data and generate content about it
      const response = await fetch(`${projectUrl}/functions/v1/fetch-accelerate-content`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`
        },
        body: JSON.stringify({
          contentType,
          limit: 5
        })
      });
      
      const result = await response.json();
      
      if (result.success && result.content) {
        // Add all generated content pieces to queue
        const newContentItems = result.content.map((piece: any, index: number) => ({
          id: Date.now() + index,
          title: `${piece.type} Update - ${piece.platform}`,
          content: piece.content,
          platform: piece.platform,
          status: 'pending',
          score: 85,
          metadata: piece.sourceData,
          createdAt: new Date().toISOString()
        }));
        
        const updatedQueue = [...newContentItems, ...contentQueue];
        setContentQueue(updatedQueue);
        updateStats(updatedQueue);
        localStorage.setItem('contentQueue', JSON.stringify(updatedQueue));
      } else {
        // Fallback to mock data if API fails
        const newContent = {
          id: Date.now(),
          title: `AI Generated Content ${contentQueue.length + 1}`,
          platform: selectedPlatforms[0] || 'twitter',
          status: 'pending',
          score: 75, // Default score for new content
          createdAt: new Date().toISOString()
        };
        const updatedQueue = [newContent, ...contentQueue];
        setContentQueue(updatedQueue);
        updateStats(updatedQueue);
        localStorage.setItem('contentQueue', JSON.stringify(updatedQueue));
      }
    } catch (error) {
      console.error('Error generating content:', error);
      // Fallback to mock data
      const newContent = {
        id: Date.now(),
        title: `Mock Content ${contentQueue.length + 1}`,
        platform: selectedPlatforms[0] || 'twitter',
        status: 'pending',
        score: 75,
        createdAt: new Date().toISOString()
      };
      const updatedQueue = [newContent, ...contentQueue];
      setContentQueue(updatedQueue);
      updateStats(updatedQueue);
      localStorage.setItem('contentQueue', JSON.stringify(updatedQueue));
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleAutomation = () => {
    setAutomationStatus(automationStatus === 'running' ? 'paused' : 'running');
  };

  return (
    <div>
      {/* Header */}
      <div className="bg-white rounded-xl p-6 mb-6 shadow-sm">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Content Automation Hub</h1>
            <p className="text-gray-600">AI-powered content generation and distribution</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={toggleAutomation}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                automationStatus === 'running' 
                  ? 'bg-red-500 hover:bg-red-600 text-white' 
                  : 'bg-green-500 hover:bg-green-600 text-white'
              }`}
            >
              {automationStatus === 'running' ? (
                <>
                  <Pause className="w-4 h-4" />
                  Pause Automation
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Start Automation
                </>
              )}
            </button>
            <button
              onClick={() => handleGenerateContent('projects')}
              disabled={isGenerating}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2 disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Package className="w-4 h-4" />
                  Projects
                </>
              )}
            </button>
            <button
              onClick={() => handleGenerateContent('funding')}
              disabled={isGenerating}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center gap-2 disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <DollarSign className="w-4 h-4" />
                  Funding
                </>
              )}
            </button>
            <button
              onClick={() => handleGenerateContent('resources')}
              disabled={isGenerating}
              className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 flex items-center gap-2 disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <BookOpen className="w-4 h-4" />
                  Resources
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl mb-6 shadow-sm">
        <div className="flex border-b">
          {['overview', 'content', 'platforms', 'analytics', 'settings'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 capitalize font-medium transition-colors ${
                activeTab === tab
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-lg bg-blue-100">
                  <TrendingUp className="w-6 h-6 text-blue-500" />
                </div>
                {stats.weeklyGrowth > 0 && (
                  <span className="text-xs text-green-600 font-semibold">+{stats.weeklyGrowth}%</span>
                )}
              </div>
              <div className="text-3xl font-bold text-gray-800">{stats.total.toLocaleString()}</div>
              <div className="text-sm text-gray-600 mt-1">Total Content</div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-lg bg-yellow-100">
                  <Clock className="w-6 h-6 text-yellow-500" />
                </div>
              </div>
              <div className="text-3xl font-bold text-gray-800">{stats.pending}</div>
              <div className="text-sm text-gray-600 mt-1">Pending Review</div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-lg bg-green-100">
                  <CheckCircle className="w-6 h-6 text-green-500" />
                </div>
              </div>
              <div className="text-3xl font-bold text-gray-800">{stats.approved.toLocaleString()}</div>
              <div className="text-sm text-gray-600 mt-1">Published</div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-lg bg-purple-100">
                  <Zap className="w-6 h-6 text-purple-500" />
                </div>
              </div>
              <div className="text-3xl font-bold text-gray-800">{stats.todayGenerated}</div>
              <div className="text-sm text-gray-600 mt-1">Generated Today</div>
            </div>
          </div>

          {/* Automation Status */}
          <div className="bg-white rounded-xl p-6 mb-6 shadow-sm">
            <h2 className="text-xl font-semibold mb-4">Automation Status</h2>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-3 h-3 rounded-full ${
                  automationStatus === 'running' ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                }`} />
                <span className="font-medium">
                  {automationStatus === 'running' ? 'Automation Running' : 'Automation Paused'}
                </span>
              </div>
              <div className="text-sm text-gray-600">
                Last run: {new Date().toLocaleTimeString()}
              </div>
            </div>
          </div>

          {/* Recent Content */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Recent Generated Content</h2>
              <button className="text-primary hover:text-primary/80 text-sm">View All</button>
            </div>
            <div className="space-y-3">
              {contentQueue.slice(0, 5).map((content) => (
                <div 
                  key={content.id} 
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                  onClick={() => setSelectedContent(content)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      content.status === 'pending' ? 'bg-yellow-500' :
                      content.status === 'approved' ? 'bg-green-500' : 'bg-red-500'
                    }`} />
                    <div>
                      <p className="font-medium">{content.title}</p>
                      <p className="text-sm text-gray-600">{content.platform} • {new Date(content.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">Score: {content.score}</span>
                    <button className="p-1 hover:bg-gray-200 rounded">
                      <Send className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                </div>
              ))}
              {contentQueue.length === 0 && (
                <p className="text-center text-gray-500 py-8">No content generated yet. Click "Generate Content" to start!</p>
              )}
            </div>
          </div>
        </>
      )}

      {activeTab === 'content' && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">Content Queue</h2>
            <div className="flex gap-2">
              <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Filter
              </button>
              <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Title</th>
                  <th className="text-left py-3 px-4">Platform</th>
                  <th className="text-left py-3 px-4">Status</th>
                  <th className="text-left py-3 px-4">Score</th>
                  <th className="text-left py-3 px-4">Created</th>
                  <th className="text-left py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {contentQueue.map((content) => (
                  <tr key={content.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">{content.title}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-1 bg-gray-100 rounded text-sm">{content.platform}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded text-sm ${
                        content.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                        content.status === 'approved' ? 'bg-green-100 text-green-700' : 
                        'bg-red-100 text-red-700'
                      }`}>
                        {content.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">{content.score}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{new Date(content.createdAt).toLocaleString()}</td>
                    <td className="py-3 px-4">
                      <button className="text-primary hover:text-primary/80">Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {contentQueue.length === 0 && (
              <p className="text-center text-gray-500 py-12">No content in queue</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'platforms' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Twitter, name: 'Twitter', key: 'twitter', connected: false, color: 'bg-blue-400' },
            { icon: Linkedin, name: 'LinkedIn', key: 'linkedin', connected: false, color: 'bg-blue-600' },
            { icon: Youtube, name: 'YouTube', key: 'youtube', connected: false, color: 'bg-red-500' },
            { icon: FileText, name: 'Blog', key: 'blog', connected: false, color: 'bg-green-500' }
          ].map((platform) => (
            <div key={platform.name} className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-lg ${platform.color} bg-opacity-10`}>
                  <platform.icon className={`w-6 h-6 ${platform.color.replace('bg-', 'text-')}`} />
                </div>
                <span className={`text-xs font-semibold ${
                  platform.connected ? 'text-green-600' : 'text-gray-400'
                }`}>
                  {platform.connected ? 'Connected' : 'Not Connected'}
                </span>
              </div>
              <h3 className="font-semibold text-lg mb-1">{platform.name}</h3>
              <p className="text-sm text-gray-600">{stats.platformStats[platform.key] || 0} posts published</p>
              <button className={`mt-4 w-full py-2 rounded-lg text-sm font-medium ${
                platform.connected 
                  ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  : 'bg-primary text-white hover:bg-primary/90'
              }`}>
                {platform.connected ? 'Configure' : 'Connect'}
              </button>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Performance Analytics</h2>
          <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
            <div className="text-center">
              <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">Analytics visualization will be displayed here</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-6">Automation Settings</h2>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Content Generation Frequency
              </label>
              <select className="w-full px-4 py-2 border border-gray-300 rounded-lg">
                <option>Every 30 minutes</option>
                <option>Every hour</option>
                <option>Every 2 hours</option>
                <option>Every 6 hours</option>
                <option>Once daily</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Default Platforms
              </label>
              <div className="space-y-2">
                {['Twitter', 'LinkedIn', 'YouTube', 'Blog'].map((platform) => (
                  <label key={platform} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedPlatforms.includes(platform.toLowerCase())}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedPlatforms([...selectedPlatforms, platform.toLowerCase()]);
                        } else {
                          setSelectedPlatforms(selectedPlatforms.filter(p => p !== platform.toLowerCase()));
                        }
                      }}
                      className="rounded text-primary"
                    />
                    <span>{platform}</span>
                  </label>
                ))}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Auto-publish Threshold
              </label>
              <input
                type="range"
                min="60"
                max="100"
                defaultValue="80"
                className="w-full"
              />
              <div className="flex justify-between text-sm text-gray-600">
                <span>60</span>
                <span>Score: 80</span>
                <span>100</span>
              </div>
            </div>
            
            <button className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90">
              Save Settings
            </button>
          </div>
        </div>
      )}

      {/* Content Modal */}
      {selectedContent && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedContent(null)}>
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-semibold">Generated Content</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedContent.platform} • Score: {selectedContent.score}/100
                </p>
              </div>
              <button 
                onClick={() => setSelectedContent(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            <div className="prose max-w-none">
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <pre className="whitespace-pre-wrap font-sans text-sm">
                  {selectedContent.content || selectedContent.title}
                </pre>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button 
                className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                onClick={() => {
                  const updated = contentQueue.map(c => 
                    c.id === selectedContent.id ? {...c, status: 'approved'} : c
                  );
                  setContentQueue(updated);
                  updateStats(updated);
                  localStorage.setItem('contentQueue', JSON.stringify(updated));
                  setSelectedContent(null);
                }}
              >
                <CheckCircle className="w-4 h-4 inline mr-2" />
                Approve
              </button>
              <button 
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                onClick={() => {
                  const updated = contentQueue.map(c => 
                    c.id === selectedContent.id ? {...c, status: 'rejected'} : c
                  );
                  setContentQueue(updated);
                  updateStats(updated);
                  localStorage.setItem('contentQueue', JSON.stringify(updated));
                  setSelectedContent(null);
                }}
              >
                <XCircle className="w-4 h-4 inline mr-2" />
                Reject
              </button>
              <button 
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                <Send className="w-4 h-4 inline mr-2" />
                Publish Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}