import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase-client';
import { 
  AlertCircle, CheckCircle, XCircle, RefreshCw, Sparkles, 
  Search, Filter, Download, Eye, Edit2, Trash2, 
  ChevronDown, ChevronUp, MoreVertical, Zap,
  TrendingUp, Clock, CheckSquare, Square, Package
} from 'lucide-react';
import { toast, Toaster } from 'sonner';

interface QueueItem {
  id: string;
  company_name?: string;
  title?: string;
  name?: string;
  description?: string;
  content?: string;
  website?: string;
  url?: string;
  source: string;
  accelerate_fit: boolean;
  accelerate_score: number;
  confidence_score?: number;
  created_at: string;
  funding_amount?: number;
  team_size?: number;
  technology_stack?: string[];
  metadata?: any;
}

interface FilterOptions {
  source: string;
  scoreRange: [number, number];
  accelerateFit: 'all' | 'yes' | 'no';
  dateRange: 'all' | 'today' | 'week' | 'month';
  searchTerm: string;
}

export default function ContentQueueEnhanced() {
  const [activeTab, setActiveTab] = useState<'projects' | 'news' | 'investors'>('projects');
  const [items, setItems] = useState<QueueItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<QueueItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedItem, setSelectedItem] = useState<QueueItem | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editingScore, setEditingScore] = useState<string | null>(null);
  
  const [filters, setFilters] = useState<FilterOptions>({
    source: 'all',
    scoreRange: [0, 10],
    accelerateFit: 'all',
    dateRange: 'all',
    searchTerm: ''
  });

  const [stats, setStats] = useState({
    total: 0,
    filtered: 0,
    selected: 0,
    avgScore: 0,
    sources: {} as Record<string, number>
  });

  // Fetch items
  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from(`queue_${activeTab}`)
        .select('*')
        .order('accelerate_score', { ascending: false });

      if (error) throw error;
      setItems(data || []);
      applyFilters(data || []);
    } catch (error) {
      toast.error('Failed to fetch items');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  // Apply filters
  const applyFilters = useCallback((itemsToFilter: QueueItem[]) => {
    let filtered = [...itemsToFilter];

    // Search filter
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(item => {
        const searchableText = [
          item.company_name,
          item.title,
          item.name,
          item.description,
          item.content,
          item.source
        ].filter(Boolean).join(' ').toLowerCase();
        return searchableText.includes(term);
      });
    }

    // Source filter
    if (filters.source !== 'all') {
      filtered = filtered.filter(item => item.source === filters.source);
    }

    // Score range filter
    filtered = filtered.filter(item => 
      item.accelerate_score >= filters.scoreRange[0] && 
      item.accelerate_score <= filters.scoreRange[1]
    );

    // Accelerate fit filter
    if (filters.accelerateFit !== 'all') {
      filtered = filtered.filter(item => 
        filters.accelerateFit === 'yes' ? item.accelerate_fit : !item.accelerate_fit
      );
    }

    // Date range filter
    if (filters.dateRange !== 'all') {
      const now = new Date();
      const cutoff = new Date();
      
      switch (filters.dateRange) {
        case 'today':
          cutoff.setHours(0, 0, 0, 0);
          break;
        case 'week':
          cutoff.setDate(now.getDate() - 7);
          break;
        case 'month':
          cutoff.setMonth(now.getMonth() - 1);
          break;
      }
      
      filtered = filtered.filter(item => 
        new Date(item.created_at) >= cutoff
      );
    }

    setFilteredItems(filtered);
    updateStats(filtered);
  }, [filters]);

  // Update statistics
  const updateStats = (items: QueueItem[]) => {
    const sources: Record<string, number> = {};
    let totalScore = 0;

    items.forEach(item => {
      sources[item.source] = (sources[item.source] || 0) + 1;
      totalScore += item.accelerate_score;
    });

    setStats({
      total: items.length,
      filtered: items.length,
      selected: selectedItems.size,
      avgScore: items.length > 0 ? totalScore / items.length : 0,
      sources
    });
  };

  // Handle batch approval
  const handleBatchApprove = async () => {
    if (selectedItems.size === 0) {
      toast.error('No items selected', {
        description: 'Please select at least one item to approve'
      });
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to approve ${selectedItems.size} item${selectedItems.size > 1 ? 's' : ''}?\n\nThis will move them to production.`
    );
    if (!confirmed) return;

    toast.loading(`Approving ${selectedItems.size} items...`);
    let succeeded = 0;
    let failed = 0;

    for (const id of selectedItems) {
      try {
        const response = await fetch('/api/approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id,
            type: activeTab,
            action: 'approve',
            reviewerNotes: 'Batch approved'
          })
        });

        if (response.ok) {
          succeeded++;
        } else {
          failed++;
        }
      } catch (error) {
        failed++;
      }
    }

    toast.dismiss();
    if (succeeded > 0 && failed === 0) {
      toast.success(`Successfully approved ${succeeded} item${succeeded > 1 ? 's' : ''}`, {
        description: 'Items have been moved to production'
      });
    } else if (succeeded > 0 && failed > 0) {
      toast.warning(`Approved ${succeeded} items, ${failed} failed`, {
        description: 'Some items could not be approved'
      });
    } else {
      toast.error('Failed to approve items', {
        description: 'Please try again or check the logs'
      });
    }
    setSelectedItems(new Set());
    await fetchItems();
  };

  // Handle batch rejection
  const handleBatchReject = async () => {
    if (selectedItems.size === 0) {
      toast.error('No items selected');
      return;
    }

    const confirmed = window.confirm(`Reject ${selectedItems.size} items?`);
    if (!confirmed) return;

    let succeeded = 0;
    for (const id of selectedItems) {
      try {
        const response = await fetch('/api/approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id,
            type: activeTab,
            action: 'reject',
            reviewerNotes: 'Batch rejected'
          })
        });

        if (response.ok) succeeded++;
      } catch (error) {
        console.error(error);
      }
    }

    toast.success(`Rejected ${succeeded} items`);
    setSelectedItems(new Set());
    await fetchItems();
  };

  // Handle single item action
  const handleItemAction = async (id: string, action: 'approve' | 'reject') => {
    try {
      const response = await fetch('/api/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          type: activeTab,
          action,
          reviewerNotes: `Individual ${action}`
        })
      });

      if (response.ok) {
        toast.success(`Item ${action}ed`);
        await fetchItems();
      } else {
        toast.error(`Failed to ${action} item`);
      }
    } catch (error) {
      toast.error('Action failed');
    }
  };

  // Handle score edit
  const handleScoreEdit = async (id: string, newScore: number) => {
    if (newScore < 0 || newScore > 10) {
      toast.error('Score must be between 0 and 10');
      return;
    }

    try {
      const { error } = await supabase
        .from(`queue_${activeTab}`)
        .update({ 
          accelerate_score: newScore,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      
      toast.success('Score updated');
      setEditingScore(null);
      await fetchItems();
    } catch (error) {
      toast.error('Failed to update score');
    }
  };

  // Export data
  const handleExport = () => {
    const dataToExport = selectedItems.size > 0 
      ? filteredItems.filter(item => selectedItems.has(item.id))
      : filteredItems;

    const csv = [
      ['ID', 'Name/Title', 'Description', 'Source', 'Score', 'Fit', 'Created'],
      ...dataToExport.map(item => [
        item.id,
        item.company_name || item.title || item.name || '',
        item.description || item.content || '',
        item.source,
        item.accelerate_score.toString(),
        item.accelerate_fit ? 'Yes' : 'No',
        new Date(item.created_at).toLocaleDateString()
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `queue_${activeTab}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  useEffect(() => {
    fetchItems();
  }, [activeTab, fetchItems]);

  useEffect(() => {
    applyFilters(items);
  }, [filters, items, applyFilters]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ctrl/Cmd + A to select all
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && !e.shiftKey) {
        e.preventDefault();
        if (filteredItems.length > 0) {
          setSelectedItems(new Set(filteredItems.map(item => item.id)));
          toast.info(`Selected all ${filteredItems.length} items`);
        }
      }
      
      // Escape to clear selection
      if (e.key === 'Escape') {
        if (selectedItems.size > 0) {
          setSelectedItems(new Set());
          toast.info('Selection cleared');
        }
        if (showDetailModal) {
          setShowDetailModal(false);
        }
      }
      
      // Ctrl/Cmd + E to export
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        handleExport();
      }
      
      // F to toggle filters
      if (e.key === 'f' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const activeElement = document.activeElement as HTMLElement;
        if (activeElement.tagName !== 'INPUT' && activeElement.tagName !== 'TEXTAREA') {
          e.preventDefault();
          setShowFilters(!showFilters);
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [filteredItems, selectedItems, showDetailModal, showFilters]);

  const getItemName = (item: QueueItem) => {
    return item.company_name || item.title || item.name || 'Unnamed';
  };

  const getItemDescription = (item: QueueItem) => {
    return item.description || item.content || '';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" />
      
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Content Queue Control Center</h1>
              <p className="text-sm text-gray-600 mt-1">
                {stats.total} total • {stats.filtered} filtered • {stats.selected} selected • 
                Avg Score: {stats.avgScore.toFixed(1)}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center gap-2"
              >
                <Filter className="w-4 h-4" />
                Filters {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              <button
                onClick={handleExport}
                className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
              <button
                onClick={fetchItems}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-4 mt-4">
            {(['projects', 'news', 'investors'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg font-medium capitalize ${
                  activeTab === tab
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="border-t px-4 py-4 bg-gray-50">
            <div className="max-w-7xl mx-auto grid grid-cols-5 gap-4">
              {/* Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={filters.searchTerm}
                    onChange={(e) => setFilters({...filters, searchTerm: e.target.value})}
                    className="w-full pl-10 pr-3 py-2 border rounded-lg"
                    placeholder="Search..."
                  />
                </div>
              </div>

              {/* Source */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
                <select
                  value={filters.source}
                  onChange={(e) => setFilters({...filters, source: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="all">All Sources</option>
                  {Object.keys(stats.sources).map(source => (
                    <option key={source} value={source}>
                      {source} ({stats.sources[source]})
                    </option>
                  ))}
                </select>
              </div>

              {/* Score Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Score: {filters.scoreRange[0]} - {filters.scoreRange[1]}
                </label>
                <div className="flex gap-2">
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.5"
                    value={filters.scoreRange[0]}
                    onChange={(e) => setFilters({
                      ...filters, 
                      scoreRange: [parseFloat(e.target.value), filters.scoreRange[1]]
                    })}
                    className="flex-1"
                  />
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.5"
                    value={filters.scoreRange[1]}
                    onChange={(e) => setFilters({
                      ...filters,
                      scoreRange: [filters.scoreRange[0], parseFloat(e.target.value)]
                    })}
                    className="flex-1"
                  />
                </div>
              </div>

              {/* Accelerate Fit */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ACCELERATE Fit</label>
                <select
                  value={filters.accelerateFit}
                  onChange={(e) => setFilters({...filters, accelerateFit: e.target.value as any})}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="all">All</option>
                  <option value="yes">Fit Only</option>
                  <option value="no">Not Fit</option>
                </select>
              </div>

              {/* Date Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
                <select
                  value={filters.dateRange}
                  onChange={(e) => setFilters({...filters, dateRange: e.target.value as any})}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">Last 7 Days</option>
                  <option value="month">Last Month</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Batch Actions Bar */}
      {selectedItems.size > 0 && (
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <span className="text-blue-900 font-medium">
              {selectedItems.size} item{selectedItems.size > 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              <button
                onClick={handleBatchApprove}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Approve Selected
              </button>
              <button
                onClick={handleBatchReject}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
              >
                <XCircle className="w-4 h-4" />
                Reject Selected
              </button>
              <button
                onClick={() => setSelectedItems(new Set())}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Clear Selection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 bg-white rounded-lg">
            <RefreshCw className="w-10 h-10 animate-spin text-blue-600 mb-4" />
            <p className="text-gray-600 font-medium">Loading queue items...</p>
            <p className="text-sm text-gray-500 mt-2">Fetching the latest content for review</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-lg border-2 border-dashed border-gray-300">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No items found</h3>
            <p className="text-gray-600 mb-6">
              {filters.searchTerm 
                ? `No items match "${filters.searchTerm}"`
                : items.length === 0 
                  ? 'The queue is empty. Fetch new content to get started.'
                  : 'Try adjusting your filters to see more items.'}
            </p>
            {items.length === 0 && (
              <button
                onClick={fetchItems}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Fetch New Content
              </button>
            )}
            {filters.searchTerm && (
              <button
                onClick={() => setFilters({...filters, searchTerm: ''})}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 inline-flex items-center gap-2"
              >
                Clear Search
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Select All */}
            <div className="flex items-center gap-4 px-4 py-2 bg-white rounded-lg">
              <input
                type="checkbox"
                checked={selectedItems.size === filteredItems.length && filteredItems.length > 0}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedItems(new Set(filteredItems.map(item => item.id)));
                  } else {
                    setSelectedItems(new Set());
                  }
                }}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium text-gray-700">Select All</span>
            </div>

            {/* Items */}
            {filteredItems.map(item => (
              <div
                key={item.id}
                className={`bg-white rounded-lg border p-4 hover:shadow-md transition-shadow ${
                  selectedItems.has(item.id) ? 'border-blue-500 bg-blue-50' : ''
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={selectedItems.has(item.id)}
                    onChange={(e) => {
                      const newSelected = new Set(selectedItems);
                      if (e.target.checked) {
                        newSelected.add(item.id);
                      } else {
                        newSelected.delete(item.id);
                      }
                      setSelectedItems(newSelected);
                    }}
                    className="w-4 h-4 mt-1"
                  />

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {getItemName(item)}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                          {getItemDescription(item)}
                        </p>
                        <div className="flex items-center gap-4 mt-2">
                          <span className="text-xs text-gray-500">
                            Source: {item.source}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(item.created_at).toLocaleDateString()}
                          </span>
                          {item.accelerate_fit && (
                            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full flex items-center gap-1">
                              <Sparkles className="w-3 h-3" />
                              ACCELERATE
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Score & Actions */}
                      <div className="flex items-center gap-3">
                        {/* Score */}
                        <div className="text-center">
                          {editingScore === item.id ? (
                            <input
                              type="number"
                              min="0"
                              max="10"
                              step="0.1"
                              defaultValue={item.accelerate_score}
                              onBlur={(e) => handleScoreEdit(item.id, parseFloat(e.target.value))}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleScoreEdit(item.id, parseFloat(e.currentTarget.value));
                                } else if (e.key === 'Escape') {
                                  setEditingScore(null);
                                }
                              }}
                              className="w-16 px-2 py-1 border rounded text-center"
                              autoFocus
                            />
                          ) : (
                            <div
                              onClick={() => setEditingScore(item.id)}
                              className="cursor-pointer hover:bg-gray-100 rounded px-2 py-1"
                            >
                              <div className={`text-2xl font-bold ${
                                item.accelerate_score >= 8 ? 'text-green-600' :
                                item.accelerate_score >= 5 ? 'text-yellow-600' :
                                'text-red-600'
                              }`}>
                                {item.accelerate_score.toFixed(1)}
                              </div>
                              <div className="text-xs text-gray-500">Score</div>
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              setSelectedItem(item);
                              setShowDetailModal(true);
                            }}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleItemAction(item.id, 'approve')}
                            className="p-2 text-green-600 hover:bg-green-100 rounded-lg"
                            title="Approve"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleItemAction(item.id, 'reject')}
                            className="p-2 text-red-600 hover:bg-red-100 rounded-lg"
                            title="Reject"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-bold">Item Details</h2>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name/Title</label>
                <p className="mt-1 text-gray-900">{getItemName(selectedItem)}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <p className="mt-1 text-gray-900">{getItemDescription(selectedItem)}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Source</label>
                  <p className="mt-1 text-gray-900">{selectedItem.source}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Score</label>
                  <p className="mt-1 text-gray-900">{selectedItem.accelerate_score}</p>
                </div>
              </div>
              
              {selectedItem.metadata && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Metadata</label>
                  <pre className="mt-1 p-2 bg-gray-100 rounded text-xs overflow-x-auto">
                    {JSON.stringify(selectedItem.metadata, null, 2)}
                  </pre>
                </div>
              )}
              
              <div className="flex gap-2 pt-4 border-t">
                <button
                  onClick={() => {
                    handleItemAction(selectedItem.id, 'approve');
                    setShowDetailModal(false);
                  }}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Approve
                </button>
                <button
                  onClick={() => {
                    handleItemAction(selectedItem.id, 'reject');
                    setShowDetailModal(false);
                  }}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}