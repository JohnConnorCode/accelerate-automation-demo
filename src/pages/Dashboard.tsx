import { useQuery } from '@tanstack/react-query'
import { TrendingUp, Clock, CheckCircle, XCircle, Package, DollarSign, BookOpen } from 'lucide-react'
import { contentService } from '../services/contentService'

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => contentService.getStats(),
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  const statCards = [
    { label: 'Total Content', value: stats?.total || 0, icon: TrendingUp, color: 'bg-blue-500' },
    { label: 'Pending Review', value: stats?.pending || 0, icon: Clock, color: 'bg-yellow-500' },
    { label: 'Approved', value: stats?.approved || 0, icon: CheckCircle, color: 'bg-green-500' },
    { label: 'Rejected', value: stats?.rejected || 0, icon: XCircle, color: 'bg-red-500' },
  ]

  return (
    <div>
      <div className="bg-white rounded-xl p-6 mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Content Automation Dashboard</h1>
        <p className="text-gray-600">Monitor and manage your automated content pipeline</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((stat, index) => (
          <div key={index} className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-lg ${stat.color} bg-opacity-10`}>
                <stat.icon className={`w-6 h-6 ${stat.color.replace('bg-', 'text-')}`} />
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-800">
              {isLoading ? '...' : stat.value.toLocaleString()}
            </div>
            <div className="text-sm text-gray-600 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">Average Score</h2>
          <div className="flex items-center justify-center h-32">
            <div className="text-5xl font-bold text-primary">
              {isLoading ? '...' : Math.round(stats?.avgScore || 0)}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">Content by Category</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-500" />
                <span className="text-gray-700">Projects</span>
              </div>
              <span className="font-semibold">{stats?.byCategory?.projects || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-500" />
                <span className="text-gray-700">Funding</span>
              </div>
              <span className="font-semibold">{stats?.byCategory?.funding || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-purple-500" />
                <span className="text-gray-700">Resources</span>
              </div>
              <span className="font-semibold">{stats?.byCategory?.resources || 0}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}