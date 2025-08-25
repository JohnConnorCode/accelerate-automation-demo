import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase-client';
import { AlertCircle, CheckCircle, XCircle, RefreshCw, Sparkles, Search, Package, DollarSign, BookOpen } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { QualityScorer } from '../services/quality-scorer';
import { ApprovalService } from '../services/approval-service';

interface QueueItem {
  id: string;
  type: string;
  title: string;
  description: string;
  url: string;
  source: string;
  status: string;
  quality_score: number;
  metadata: any;
  created_at: string;
  enriched: boolean;
  enrichment_data?: any;
}

interface Stats {
  pending: number;
  approved: number;
  rejected: number;
  autoApproved: number;
  avgQualityScore: number;
}

export default function ContentQueue() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [stats, setStats] = useState<Stats>({
    pending: 0,
    approved: 0,
    rejected: 0,
    autoApproved: 0,
    avgQualityScore: 0
  });
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [scoreFilter, setScoreFilter] = useState<string>('');
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectingItemId, setRejectingItemId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const approvalService = new ApprovalService();

  useEffect(() => {
    loadQueue();
    loadStats();
  }, [typeFilter, scoreFilter, sourceFilter]);

  const loadQueue = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('content_queue')
        .select('*')
        .in('status', ['pending_review', 'ready_for_review'])
        .order('quality_score', { ascending: false });

      if (typeFilter) query = query.eq('type', typeFilter);
      if (sourceFilter) query = query.eq('source', sourceFilter);
      if (scoreFilter) query = query.gte('quality_score', parseInt(scoreFilter));

      const { data, error } = await query;

      if (error) throw error;

      // Calculate quality scores for items without them
      const itemsWithScores = await Promise.all((data || []).map(async (item) => {
        if (!item.quality_score) {
          const score = await QualityScorer.scoreContent(item);
          await supabase
            .from('content_queue')
            .update({ quality_score: score.total })
            .eq('id', item.id);
          item.quality_score = score.total;
        }
        return item;
      }));

      setQueue(itemsWithScores);
    } catch (error) {
      console.error('Error loading queue:', error);
      toast.error('Failed to load approval queue');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const stats = await approvalService.getStats();
      setStats(stats);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const approveItem = async (itemId: string) => {
    try {
      const result = await approvalService.approveContent(itemId, 'user', 'Manually approved via dashboard');
      
      if (result.success) {
        toast.success(`Content approved and moved to ${result.targetTable}`);
        loadQueue();
        loadStats();
      } else {
        toast.error(result.error || 'Failed to approve content');
      }
    } catch (error) {
      toast.error('Error approving content');
    }
  };

  const rejectItem = async () => {
    if (!rejectingItemId || !rejectionReason) return;

    try {
      const result = await approvalService.rejectContent(rejectingItemId, rejectionReason, 'user');
      
      if (result.success) {
        toast.success('Content rejected');
        setRejectModalOpen(false);
        setRejectingItemId(null);
        setRejectionReason('');
        loadQueue();
        loadStats();
      } else {
        toast.error(result.error || 'Failed to reject content');
      }
    } catch (error) {
      toast.error('Error rejecting content');
    }
  };

  const enrichItem = async (itemId: string) => {
    try {
      const result = await approvalService.enrichContent(itemId);
      
      if (result.success) {
        toast.success('Content sent for enrichment');
        loadQueue();
      } else {
        toast.error(result.error || 'Failed to enrich content');
      }
    } catch (error) {
      toast.error('Error enriching content');
    }
  };

  const bulkApprove = async () => {
    const highQualityItems = queue.filter(item => item.quality_score >= 70);
    
    if (highQualityItems.length === 0) {
      toast.info('No high-quality items to approve');
      return;
    }

    const itemIds = highQualityItems.map(item => item.id);
    const results = await approvalService.bulkApprove(itemIds, 'user');
    
    const successCount = results.filter(r => r.success).length;
    toast.success(`Approved ${successCount} out of ${itemIds.length} items`);
    
    loadQueue();
    loadStats();
  };

  const runAutoApproval = async () => {
    try {
      const result = await approvalService.autoApprove(80);
      toast.success(`Auto-approved ${result.approved} items`);
      if (result.errors > 0) {
        toast.warning(`${result.errors} items had errors`);
      }
      loadQueue();
      loadStats();
    } catch (error) {
      toast.error('Error running auto-approval');
    }
  };

  const runDiscovery = async () => {
    try {
      // Call the orchestrator directly to fetch new content
      const response = await fetch('/api/scheduler/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: 'content-fetch' }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to run discovery');
      }
      
      const data = await response.json();
      
      if (data.success && data.result) {
        toast.success(`Discovery complete! Fetched ${data.result.fetched || 0} items, stored ${data.result.stored || 0} unique items.`);
        loadQueue();
      } else {
        toast.error('Discovery failed - check console for details');
      }
    } catch (error) {
      console.error('Discovery error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to run discovery');
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-600';
    if (score >= 50) return 'text-orange-600';
    return 'text-red-600';
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'project':
        return <Package className="w-4 h-4 text-blue-500" />;
      case 'funding':
        return <DollarSign className="w-4 h-4 text-green-500" />;
      case 'resource':
        return <BookOpen className="w-4 h-4 text-purple-500" />;
      default:
        return null;
    }
  };

  return (
    <>
      <Toaster position="top-right" />
      <div className="bg-white rounded-xl">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Content Approval Queue</h1>
              <p className="text-gray-600 mt-1">
                Review and approve content before it goes live on Accelerate
              </p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={loadQueue} 
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
              <button 
                onClick={runDiscovery} 
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2"
              >
                <Search className="h-4 w-4" />
                Run Discovery
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-5 gap-4 mt-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Pending Review</div>
              <div className="text-2xl font-bold">{stats.pending}</div>
            </div>
            
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Approved</div>
              <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
            </div>
            
            <div className="bg-red-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Rejected</div>
              <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
            </div>
            
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Auto-Approved</div>
              <div className="text-2xl font-bold text-blue-600">{stats.autoApproved}</div>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Avg Quality</div>
              <div className={`text-2xl font-bold ${getScoreColor(stats.avgQualityScore)}`}>
                {stats.avgQualityScore}
              </div>
            </div>
          </div>
        </div>

        {/* Auto-Approval Section */}
        <div className="p-6 border-b bg-blue-50">
          <div className="bg-white rounded-lg p-6 border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold">Auto-Approval System</h2>
            </div>
            <p className="text-gray-600 mb-4">
              Automatically approve items with quality score ≥ 80 and no red flags
            </p>
            <div className="flex gap-3">
              <button 
                onClick={runAutoApproval} 
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Run Auto-Approval
              </button>
              <button 
                onClick={bulkApprove} 
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <CheckCircle className="h-4 w-4" />
                Bulk Approve (70+)
              </button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="p-6 border-b">
          <div className="flex gap-4">
            <select 
              value={typeFilter} 
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary"
            >
              <option value="">All Types</option>
              <option value="project">Projects</option>
              <option value="funding">Funding</option>
              <option value="resource">Resources</option>
            </select>

            <select 
              value={scoreFilter} 
              onChange={(e) => setScoreFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary"
            >
              <option value="">All Scores</option>
              <option value="80">80+ (High)</option>
              <option value="60">60+ (Medium)</option>
              <option value="40">40+ (Low)</option>
            </select>

            <select 
              value={sourceFilter} 
              onChange={(e) => setSourceFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary"
            >
              <option value="">All Sources</option>
              <option value="github">GitHub</option>
              <option value="defillama">DeFiLlama</option>
              <option value="coingecko">CoinGecko</option>
            </select>
          </div>
        </div>

        {/* Queue Items */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-8">Loading queue...</div>
          ) : queue.length === 0 ? (
            <div className="bg-gray-50 rounded-lg p-8 text-center">
              <p className="text-gray-500">No items pending review 🎉</p>
            </div>
          ) : (
            <div className="space-y-4">
              {queue.map((item) => (
                <div key={item.id} className="bg-white border rounded-lg overflow-hidden">
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold flex items-center gap-2">
                          {getTypeIcon(item.type)}
                          {item.title || 'Untitled'}
                        </h3>
                        <div className="flex gap-2 mt-2">
                          <span className={`px-2 py-1 text-xs rounded ${
                            item.type === 'project' ? 'bg-blue-100 text-blue-700' : 
                            item.type === 'funding' ? 'bg-green-100 text-green-700' : 
                            'bg-purple-100 text-purple-700'
                          }`}>
                            {item.type}
                          </span>
                          <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                            Source: {item.source}
                          </span>
                          {item.enriched && (
                            <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded">
                              ✨ Enriched
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className={`text-3xl font-bold ${getScoreColor(item.quality_score || 0)}`}>
                          {item.quality_score || 0}
                        </div>
                        <div className="text-xs text-gray-500">Quality Score</div>
                      </div>
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-4">
                      {item.description || 'No description available'}
                    </p>

                    {/* Metadata */}
                    {(item.url || item.metadata?.github_url || item.metadata?.team_size || item.metadata?.funding_raised) && (
                      <div className="grid grid-cols-2 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
                        {item.url && (
                          <div>
                            <span className="text-sm font-medium">URL: </span>
                            <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                              {item.url}
                            </a>
                          </div>
                        )}
                        {item.metadata?.github_url && (
                          <div>
                            <span className="text-sm font-medium">GitHub: </span>
                            <a href={item.metadata.github_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                              View Repository
                            </a>
                          </div>
                        )}
                        {item.metadata?.team_size && (
                          <div>
                            <span className="text-sm font-medium">Team Size: </span>
                            <span className="text-sm">{item.metadata.team_size}</span>
                          </div>
                        )}
                        {item.metadata?.funding_raised && (
                          <div>
                            <span className="text-sm font-medium">Funding: </span>
                            <span className="text-sm">${item.metadata.funding_raised.toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button 
                        onClick={() => approveItem(item.id)}
                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors flex items-center gap-2"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Approve
                      </button>
                      
                      <button 
                        onClick={() => {
                          setRejectingItemId(item.id);
                          setRejectModalOpen(true);
                        }}
                        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors flex items-center gap-2"
                      >
                        <XCircle className="h-4 w-4" />
                        Reject
                      </button>
                      
                      {!item.enriched && (
                        <button 
                          onClick={() => enrichItem(item.id)}
                          className="px-4 py-2 border border-orange-600 text-orange-600 rounded hover:bg-orange-50 transition-colors flex items-center gap-2"
                        >
                          <RefreshCw className="h-4 w-4" />
                          Enrich
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Rejection Modal */}
        {rejectModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold mb-2">Reject Content</h3>
              <p className="text-gray-600 mb-4">
                Please provide a reason for rejecting this content.
              </p>
              
              <textarea
                placeholder="Enter rejection reason..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary min-h-[100px]"
              />
              
              <div className="flex gap-2 mt-4 justify-end">
                <button 
                  onClick={() => setRejectModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={rejectItem}
                  disabled={!rejectionReason}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}