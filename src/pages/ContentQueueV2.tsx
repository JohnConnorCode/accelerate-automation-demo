import type { Database } from '../types/supabase';
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase-client';
import { AlertCircle, CheckCircle, XCircle, RefreshCw, Sparkles, Search, Package, DollarSign, BookOpen } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { metricsService } from '../services/metrics';

interface QueueProject {
  id: string;
  company_name: string;
  description: string;
  website: string;
  source: string;
  accelerate_fit: boolean;
  accelerate_score: number;
  created_at: string;
}

interface QueueNews {
  id: string;
  title: string;
  content: string;
  url: string;
  source: string;
  accelerate_fit: boolean;
  accelerate_score: number;
  created_at: string;
}

interface QueueInvestor {
  id: string;
  name: string;
  description: string;
  website: string;
  source: string;
  accelerate_fit: boolean;
  accelerate_score: number;
  created_at: string;
}

type QueueItem = QueueProject | QueueNews | QueueInvestor;

export default function ContentQueueV2() {
  const [activeTab, setActiveTab] = useState<'projects' | 'news' | 'investors'>('news');
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    projects: 0,
    news: 0,
    investors: 0,
    accelerateFit: 0
  });

  const fetchQueueData = async () => {
    setLoading(true);
    try {
      let data: any[] = [];
      let tableName = '';
      
      switch (activeTab) {
        case 'projects':
          tableName = 'queue_projects';
          const { data: projects } = await supabase
            .from(tableName)
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);
          data = projects || [];
          break;
          
        case 'news':
          tableName = 'queue_news';
          const { data: news } = await supabase
            .from(tableName)
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);
          data = news || [];
          break;
          
        case 'investors':
          tableName = 'queue_investors';
          const { data: investors } = await supabase
            .from(tableName)
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);
          data = investors || [];
          break;
      }
      
      setItems(data);
      
      // Fetch stats
      const { count: projectCount } = await supabase
        .from('queue_projects')
        .select('*', { count: 'exact', head: true });
        
      const { count: newsCount } = await supabase
        .from('queue_news')
        .select('*', { count: 'exact', head: true });
        
      const { count: investorCount } = await supabase
        .from('queue_investors')
        .select('*', { count: 'exact', head: true });
        
      const { count: accelerateCount } = await supabase
        .from('queue_news')
        .select('*', { count: 'exact', head: true })
        .eq('accelerate_fit', true);
      
      setStats({
        projects: projectCount || 0,
        news: newsCount || 0,
        investors: investorCount || 0,
        accelerateFit: accelerateCount || 0
      });
      
    } catch (error) {
      console.error('Error fetching queue:', error);
      toast.error('Failed to load queue data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueueData();
  }, [activeTab]);

  const approveItem = async (item: QueueItem) => {
    try {
      let targetTable = '';
      let insertData: any = {};
      
      if ('company_name' in item) {
        targetTable = 'accelerate_startups';
        insertData = {
          name: item.company_name,
          description: item.description,
          website: item.website,
          source: item.source,
          accelerate_fit: item.accelerate_fit,
          accelerate_score: item.accelerate_score
        };
      } else if ('title' in item) {
        targetTable = 'accelerate_news';
        insertData = {
          title: item.title,
          content: item.content,
          url: item.url,
          source: item.source,
          accelerate_fit: item.accelerate_fit,
          accelerate_score: item.accelerate_score
        };
      } else {
        targetTable = 'accelerate_investors';
        insertData = {
          name: item.name,
          description: item.description,
          website: item.website,
          source: item.source,
          accelerate_fit: item.accelerate_fit,
          accelerate_score: item.accelerate_score
        };
      }
      
      // Move to live table
      const { error: insertError } = await supabase
        .from(targetTable)
        .insert(insertData as any);
      
      if (insertError) {throw insertError;}
      
      // Remove from queue
      const queueTable = activeTab === 'projects' ? 'queue_projects' : 
                        activeTab === 'news' ? 'queue_news' : 'queue_investors';
                        
      const { error: deleteError } = await supabase
        .from(queueTable)
        .delete()
        .eq('id', item.id);
      
      if (deleteError) {throw deleteError;}
      
      // Track approval metric
      metricsService.trackApproval(true);
      
      toast.success('Item approved and moved to live data');
      fetchQueueData();
      
    } catch (error) {
      console.error('Approval error:', error);
      toast.error('Failed to approve item');
    }
  };

  const rejectItem = async (item: QueueItem) => {
    try {
      const queueTable = activeTab === 'projects' ? 'queue_projects' : 
                        activeTab === 'news' ? 'queue_news' : 'queue_investors';
                        
      const { error } = await supabase
        .from(queueTable)
        .delete()
        .eq('id', item.id);
      
      if (error) {throw error;}
      
      // Track rejection metric
      metricsService.trackApproval(false);
      
      toast.success('Item rejected');
      fetchQueueData();
      
    } catch (error) {
      console.error('Rejection error:', error);
      toast.error('Failed to reject item');
    }
  };

  const getItemTitle = (item: QueueItem): string => {
    if ('company_name' in item) {return item.company_name;}
    if ('title' in item) {return item.title;}
    return item.name;
  };

  const getItemDescription = (item: QueueItem): string => {
    if ('content' in item) {return item.content || item.description || '';}
    return item.description || '';
  };

  const getItemUrl = (item: QueueItem): string => {
    if ('website' in item) {return item.website || '';}
    if ('url' in item) {return item.url || '';}
    return '';
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <Toaster position="top-right" />
      
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Content Queue</h1>
        <p className="text-gray-600">Review and approve incoming content</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-600">Projects</div>
          <div className="text-2xl font-bold">{stats.projects}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-600">News</div>
          <div className="text-2xl font-bold">{stats.news}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-600">Investors</div>
          <div className="text-2xl font-bold">{stats.investors}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-600">ACCELERATE Fit</div>
          <div className="text-2xl font-bold text-green-600">{stats.accelerateFit}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex">
            <button
              onClick={() => setActiveTab('projects')}
              className={`py-2 px-6 border-b-2 font-medium text-sm ${
                activeTab === 'projects'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Package className="inline-block w-4 h-4 mr-2" />
              Projects ({stats.projects})
            </button>
            <button
              onClick={() => setActiveTab('news')}
              className={`py-2 px-6 border-b-2 font-medium text-sm ${
                activeTab === 'news'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <BookOpen className="inline-block w-4 h-4 mr-2" />
              News ({stats.news})
            </button>
            <button
              onClick={() => setActiveTab('investors')}
              className={`py-2 px-6 border-b-2 font-medium text-sm ${
                activeTab === 'investors'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <DollarSign className="inline-block w-4 h-4 mr-2" />
              Investors ({stats.investors})
            </button>
            <button
              onClick={fetchQueueData}
              className="ml-auto py-2 px-4 text-gray-500 hover:text-gray-700"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-gray-400" />
              <p className="mt-2 text-gray-500">Loading queue...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 mx-auto text-gray-400" />
              <p className="mt-2 text-gray-500">No items in queue</p>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <div key={item.id} className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-1">
                        {getItemTitle(item)}
                      </h3>
                      <p className="text-gray-600 text-sm mb-2 line-clamp-2">
                        {getItemDescription(item)}
                      </p>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>Source: {item.source}</span>
                        {getItemUrl(item) && (
                          <a href={getItemUrl(item)} target="_blank" rel="noopener noreferrer" 
                             className="text-blue-500 hover:underline">
                            View →
                          </a>
                        )}
                        {item.accelerate_fit && (
                          <span className="bg-green-100 text-green-800 px-2 py-1 rounded">
                            <Sparkles className="inline-block w-3 h-3 mr-1" />
                            ACCELERATE
                          </span>
                        )}
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          Score: {item.accelerate_score?.toFixed(1) || '0'}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => approveItem(item)}
                        className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => rejectItem(item)}
                        className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}