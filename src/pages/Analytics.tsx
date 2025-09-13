import { useQuery } from '@tanstack/react-query';
import { BarChart3, TrendingUp, Activity, Zap } from 'lucide-react';

interface AnalyticsData {
  contentByType: { type: string; count: number }[]
  contentByStatus: { status: string; count: number }[]
  scoreDistribution: { range: string; count: number }[]
  dailyActivity: { date: string; count: number }[]
}

export default function Analytics() {
  const { data, isLoading } = useQuery<AnalyticsData>({
    queryKey: ['analytics'],
    queryFn: async () => {
      // Mock data for now - will connect to real API
      return {
        contentByType: [
          { type: 'Articles', count: 245 },
          { type: 'Videos', count: 123 },
          { type: 'Podcasts', count: 87 },
          { type: 'Research', count: 156 },
        ],
        contentByStatus: [
          { status: 'Approved', count: 385 },
          { status: 'Pending', count: 126 },
          { status: 'Rejected', count: 100 },
        ],
        scoreDistribution: [
          { range: '0-25', count: 45 },
          { range: '26-50', count: 123 },
          { range: '51-75', count: 267 },
          { range: '76-100', count: 176 },
        ],
        dailyActivity: [
          { date: 'Mon', count: 87 },
          { date: 'Tue', count: 92 },
          { date: 'Wed', count: 103 },
          { date: 'Thu', count: 95 },
          { date: 'Fri', count: 110 },
          { date: 'Sat', count: 65 },
          { date: 'Sun', count: 59 },
        ],
      };
    },
  });

  return (
    <div>
      <div className="bg-white rounded-xl p-6 mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Analytics</h1>
        <p className="text-gray-600">Track performance and content insights</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Content by Type */}
        <div className="bg-white rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold">Content by Type</h2>
          </div>
          
          {isLoading ? (
            <div className="h-48 flex items-center justify-center text-gray-500">
              Loading...
            </div>
          ) : (
            <div className="space-y-3">
              {data?.contentByType.map((item) => (
                <div key={item.type}>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm text-gray-700">{item.type}</span>
                    <span className="text-sm font-semibold">{item.count}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full"
                      style={{
                        width: `${(item.count / Math.max(...(data?.contentByType.map(i => i.count) || [1]))) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Content by Status */}
        <div className="bg-white rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-secondary" />
            <h2 className="text-xl font-semibold">Content by Status</h2>
          </div>
          
          {isLoading ? (
            <div className="h-48 flex items-center justify-center text-gray-500">
              Loading...
            </div>
          ) : (
            <div className="space-y-3">
              {data?.contentByStatus.map((item) => (
                <div key={item.status}>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm text-gray-700">{item.status}</span>
                    <span className="text-sm font-semibold">{item.count}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        item.status === 'Approved'
                          ? 'bg-green-500'
                          : item.status === 'Pending'
                          ? 'bg-yellow-500'
                          : 'bg-red-500'
                      }`}
                      style={{
                        width: `${(item.count / Math.max(...(data?.contentByStatus.map(i => i.count) || [1]))) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Score Distribution */}
        <div className="bg-white rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-yellow-500" />
            <h2 className="text-xl font-semibold">Score Distribution</h2>
          </div>
          
          {isLoading ? (
            <div className="h-48 flex items-center justify-center text-gray-500">
              Loading...
            </div>
          ) : (
            <div className="flex items-end justify-between h-48 gap-2">
              {data?.scoreDistribution.map((item) => (
                <div key={item.range} className="flex-1 flex flex-col items-center">
                  <div className="text-sm font-semibold mb-2">{item.count}</div>
                  <div
                    className="w-full bg-gradient-to-t from-primary to-secondary rounded-t"
                    style={{
                      height: `${(item.count / Math.max(...(data?.scoreDistribution.map(i => i.count) || [1]))) * 100}%`,
                    }}
                  />
                  <div className="text-xs text-gray-600 mt-2">{item.range}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Daily Activity */}
        <div className="bg-white rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-green-500" />
            <h2 className="text-xl font-semibold">Daily Activity</h2>
          </div>
          
          {isLoading ? (
            <div className="h-48 flex items-center justify-center text-gray-500">
              Loading...
            </div>
          ) : (
            <div className="flex items-end justify-between h-48 gap-2">
              {data?.dailyActivity.map((item) => (
                <div key={item.date} className="flex-1 flex flex-col items-center">
                  <div className="text-sm font-semibold mb-2">{item.count}</div>
                  <div
                    className="w-full bg-gradient-to-t from-green-400 to-green-600 rounded-t"
                    style={{
                      height: `${(item.count / Math.max(...(data?.dailyActivity.map(i => i.count) || [1]))) * 100}%`,
                    }}
                  />
                  <div className="text-xs text-gray-600 mt-2">{item.date}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}