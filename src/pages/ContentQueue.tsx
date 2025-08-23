import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, X, Zap, RefreshCw, Search, Package, DollarSign, BookOpen } from 'lucide-react'
import { contentService, ContentCategory } from '../services/contentService'

export default function ContentQueue() {
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<ContentCategory | ''>('')

  const { data: items = [], isLoading, refetch } = useQuery({
    queryKey: ['content-queue', statusFilter, categoryFilter],
    queryFn: () => contentService.getQueue({
      status: statusFilter || undefined,
      category: categoryFilter || undefined
    }),
  })

  const approveMutation = useMutation({
    mutationFn: (id: string) => contentService.approveContent([id]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-queue'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
  })

  const rejectMutation = useMutation({
    mutationFn: (id: string) => contentService.rejectContent([id]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-queue'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
  })

  const enrichMutation = useMutation({
    mutationFn: (id: string) => contentService.enrichContent(id, {
      aiAnalysis: true,
      sentiment: true,
      keywords: true,
      category: true,
      summary: true
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-queue'] })
    },
  })

  const runDiscovery = async () => {
    const response = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'manual' }),
    })
    const data = await response.json()
    alert(`Discovery complete! Found ${data.found || 0} new items.`)
    refetch()
  }

  return (
    <div className="bg-white rounded-xl p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Content Queue</h1>
        <div className="flex gap-3">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={runDiscovery}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Search className="w-4 h-4" />
            Run Discovery
          </button>
        </div>
      </div>

      <div className="flex gap-4 mb-6">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary"
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as ContentCategory | '')}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary"
        >
          <option value="">All Categories</option>
          <option value="projects">Projects</option>
          <option value="funding">Funding</option>
          <option value="resources">Resources</option>
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Title</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Source</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Category</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Score</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-gray-500">
                  No content items found
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <div className="font-medium text-gray-900">{item.title}</div>
                    {item.description && (
                      <div className="text-sm text-gray-500 mt-1 line-clamp-2">
                        {item.description}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-gray-600">{item.source}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      {item.category === 'projects' && <Package className="w-4 h-4 text-blue-500" />}
                      {item.category === 'funding' && <DollarSign className="w-4 h-4 text-green-500" />}
                      {item.category === 'resources' && <BookOpen className="w-4 h-4 text-purple-500" />}
                      <span className="capitalize">{item.category}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-semibold text-gray-700">{item.score}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-1 rounded text-sm ${
                        item.status === 'approved'
                          ? 'bg-green-100 text-green-700'
                          : item.status === 'rejected'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => approveMutation.mutate(item.id)}
                        disabled={approveMutation.isPending}
                        className="p-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors disabled:opacity-50"
                        title="Approve"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => rejectMutation.mutate(item.id)}
                        disabled={rejectMutation.isPending}
                        className="p-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors disabled:opacity-50"
                        title="Reject"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => enrichMutation.mutate(item.id)}
                        disabled={enrichMutation.isPending}
                        className="p-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors disabled:opacity-50"
                        title="Enrich"
                      >
                        <Zap className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}