import { useState, useEffect } from 'react'
import { 
  Key, Save, Plus, Trash2, Eye, EyeOff, CheckCircle, 
  AlertCircle, Database, Brain, Globe, FileText, 
  Sparkles, Zap, Shield, Copy
} from 'lucide-react'
import { supabase } from '../lib/supabase-client'

interface ApiKey {
  id: string
  service_name: string
  key_name: string
  encrypted_key: string
  description?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export default function ApiConfig() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})
  const [isAdding, setIsAdding] = useState(false)
  const [newKey, setNewKey] = useState({
    name: '',
    service: 'openai',
    key: ''
  })

  // Available services for content automation - Web3 & Startup focused
  const services = [
    // AI Services
    { id: 'openai', name: 'OpenAI', icon: Brain, color: 'bg-green-500', description: 'GPT-4 Content Generation' },
    { id: 'anthropic', name: 'Anthropic', icon: Sparkles, color: 'bg-purple-500', description: 'Claude AI Assistant' },
    
    // Web3 & Crypto Sources
    { id: 'producthunt', name: 'Product Hunt', icon: Database, color: 'bg-orange-500', description: 'Startup Launches' },
    { id: 'crunchbase', name: 'Crunchbase', icon: Database, color: 'bg-blue-600', description: 'Funding & Companies' },
    { id: 'messari', name: 'Messari', icon: Globe, color: 'bg-indigo-600', description: 'Crypto Research' },
    { id: 'defillama', name: 'DefiLlama', icon: Database, color: 'bg-purple-600', description: 'DeFi Analytics' },
    { id: 'dune', name: 'Dune Analytics', icon: Database, color: 'bg-gray-700', description: 'Blockchain Data' },
    { id: 'etherscan', name: 'Etherscan', icon: Database, color: 'bg-blue-700', description: 'Ethereum Explorer' },
    { id: 'coingecko', name: 'CoinGecko', icon: Globe, color: 'bg-green-600', description: 'Crypto Prices' },
    { id: 'alchemy', name: 'Alchemy', icon: Zap, color: 'bg-blue-500', description: 'Web3 Infrastructure' },
    
    // Social & Community
    { id: 'farcaster', name: 'Farcaster', icon: Globe, color: 'bg-purple-700', description: 'Web3 Social' },
    { id: 'lens', name: 'Lens Protocol', icon: Globe, color: 'bg-green-700', description: 'Decentralized Social' },
    { id: 'mirror', name: 'Mirror.xyz', icon: FileText, color: 'bg-gray-600', description: 'Web3 Publishing' },
    { id: 'discord', name: 'Discord', icon: Globe, color: 'bg-indigo-500', description: 'Community Data' },
    
    // Developer & Technical
    { id: 'github', name: 'GitHub', icon: Database, color: 'bg-gray-800', description: 'Code Repositories' },
    { id: 'npm', name: 'NPM Registry', icon: Database, color: 'bg-red-600', description: 'Package Stats' },
    
    // News & Research
    { id: 'decrypt', name: 'Decrypt', icon: FileText, color: 'bg-red-500', description: 'Crypto News' },
    { id: 'theblock', name: 'The Block', icon: FileText, color: 'bg-black', description: 'Blockchain News' },
    { id: 'techcrunch', name: 'TechCrunch', icon: FileText, color: 'bg-green-500', description: 'Tech News' },
    
    // Custom Integration
    { id: 'rss', name: 'RSS Feeds', icon: Zap, color: 'bg-yellow-500', description: 'Custom Feeds' },
    { id: 'webhook', name: 'Webhooks', icon: Zap, color: 'bg-gray-500', description: 'Custom Events' }
  ]

  useEffect(() => {
    // Load API keys from database
    loadApiKeys()
  }, [])

  const loadApiKeys = async () => {
    try {
      const { data, error } = await supabase
        .from('api_keys')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setApiKeys(data || [])
    } catch (error) {
      console.error('Error loading API keys:', error)
      // Fallback to localStorage if database fails
      const savedKeys = localStorage.getItem('apiKeys')
      if (savedKeys) {
        try {
          const parsed = JSON.parse(savedKeys)
          // Convert old format to new if needed
          const converted = parsed.map((k: any) => ({
            id: k.id,
            service_name: k.service || k.service_name,
            key_name: k.name || k.key_name,
            encrypted_key: k.key || k.encrypted_key,
            description: k.description || `${k.name} for ${k.service}`,
            is_active: k.isActive !== undefined ? k.isActive : k.is_active,
            created_at: k.addedAt || k.created_at || new Date().toISOString(),
            updated_at: k.updated_at || new Date().toISOString()
          }))
          setApiKeys(converted)
        } catch (e) {
          console.error('Error parsing localStorage:', e)
        }
      }
    }
  }

  const addApiKey = async () => {
    if (!newKey.name || !newKey.key) {
      alert('Please fill in all fields')
      return
    }

    try {
      const { data, error } = await supabase
        .from('api_keys')
        .insert({
          service: newKey.service,
          key_name: newKey.name,
          encrypted_key: newKey.key, // In production, this should be encrypted
          is_active: true,
          usage_count: 0
        })
        .select()
        .single()

      if (error) throw error

      setApiKeys([data, ...apiKeys])
      setNewKey({ name: '', service: 'openai', key: '' })
      setIsAdding(false)
      
      // Also save to localStorage as backup
      localStorage.setItem('apiKeys', JSON.stringify([data, ...apiKeys]))
    } catch (error) {
      console.error('Error saving API key:', error)
      alert('Failed to save API key. Check console for details.')
    }
  }

  const deleteApiKey = async (id: string) => {
    if (confirm('Are you sure you want to delete this API key?')) {
      try {
        const { error } = await supabase
          .from('api_keys')
          .delete()
          .eq('id', id)

        if (error) throw error

        const updatedKeys = apiKeys.filter(key => key.id !== id)
        setApiKeys(updatedKeys)
        localStorage.setItem('apiKeys', JSON.stringify(updatedKeys))
      } catch (error) {
        console.error('Error deleting API key:', error)
        alert('Failed to delete API key')
      }
    }
  }

  const toggleKeyVisibility = (id: string) => {
    setShowKeys(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const toggleKeyActive = async (id: string) => {
    const key = apiKeys.find(k => k.id === id)
    if (!key) return

    try {
      const { error } = await supabase
        .from('api_keys')
        .update({ 
          is_active: !key.is_active,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)

      if (error) throw error

      const updatedKeys = apiKeys.map(k => 
        k.id === id ? { ...k, is_active: !k.is_active } : k
      )
      setApiKeys(updatedKeys)
      localStorage.setItem('apiKeys', JSON.stringify(updatedKeys))
    } catch (error) {
      console.error('Error updating API key:', error)
    }
  }

  const maskKey = (key: string) => {
    if (key.length <= 8) return '••••••••'
    return key.slice(0, 4) + '•'.repeat(20) + key.slice(-4)
  }

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key)
    // Could add a toast notification here
  }

  const getServiceIcon = (serviceId: string) => {
    const service = services.find(s => s.id === serviceId)
    return service || services[services.length - 1] // Default to custom
  }

  return (
    <div>
      {/* Header */}
      <div className="bg-white rounded-xl p-6 mb-6 shadow-sm">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">API Configuration</h1>
            <p className="text-gray-600">Manage your content automation API keys and data sources</p>
          </div>
          <button
            onClick={() => setIsAdding(true)}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add API Key
          </button>
        </div>
      </div>

      {/* Add New Key Form */}
      {isAdding && (
        <div className="bg-white rounded-xl p-6 mb-6 shadow-sm border-2 border-primary">
          <h2 className="text-xl font-semibold mb-4">Add New API Key</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name/Label</label>
              <input
                type="text"
                value={newKey.name}
                onChange={(e) => setNewKey({ ...newKey, name: e.target.value })}
                placeholder="My OpenAI Key"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Service</label>
              <select
                value={newKey.service}
                onChange={(e) => setNewKey({ ...newKey, service: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {services.map(service => (
                  <option key={service.id} value={service.id}>
                    {service.name} - {service.description}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
              <input
                type="password"
                value={newKey.key}
                onChange={(e) => setNewKey({ ...newKey, key: e.target.value })}
                placeholder="sk-..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={addApiKey}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Save API Key
            </button>
            <button
              onClick={() => {
                setIsAdding(false)
                setNewKey({ name: '', service: 'openai', key: '' })
              }}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Service Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
        {services.map(service => {
          const count = apiKeys.filter(k => k.service_name === service.id).length
          const ServiceIcon = service.icon
          return (
            <div key={service.id} className="bg-white rounded-lg p-4 shadow-sm">
              <div className={`w-10 h-10 ${service.color} bg-opacity-10 rounded-lg flex items-center justify-center mb-2`}>
                <ServiceIcon className={`w-5 h-5 ${service.color.replace('bg-', 'text-')}`} />
              </div>
              <h3 className="font-medium text-sm">{service.name}</h3>
              <p className="text-xs text-gray-600 mt-1">{count} key{count !== 1 ? 's' : ''}</p>
            </div>
          )
        })}
      </div>

      {/* API Keys List */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">Configured API Keys</h2>
          <p className="text-sm text-gray-600 mt-1">
            {apiKeys.length} total keys • {apiKeys.filter(k => k.is_active).length} active
          </p>
        </div>
        
        {apiKeys.length === 0 ? (
          <div className="p-12 text-center">
            <Key className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No API keys configured yet</p>
            <p className="text-sm text-gray-400 mt-2">Add your first API key to start automating content</p>
          </div>
        ) : (
          <div className="divide-y">
            {apiKeys.map(apiKey => {
              const service = getServiceIcon(apiKey.service_name)
              const ServiceIcon = service.icon
              return (
                <div key={apiKey.id} className="p-6 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 ${service.color} bg-opacity-10 rounded-lg flex items-center justify-center`}>
                        <ServiceIcon className={`w-5 h-5 ${service.color.replace('bg-', 'text-')}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{apiKey.key_name}</h3>
                          {apiKey.is_active ? (
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              Active
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              Inactive
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          {service.name} • Added {new Date(apiKey.created_at).toLocaleDateString()}
                          {apiKey.description && ` • ${apiKey.description}`}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <code className="text-sm bg-gray-100 px-2 py-1 rounded font-mono">
                            {showKeys[apiKey.id] ? apiKey.encrypted_key : maskKey(apiKey.encrypted_key)}
                          </code>
                          <button
                            onClick={() => toggleKeyVisibility(apiKey.id)}
                            className="p-1 hover:bg-gray-200 rounded"
                            title={showKeys[apiKey.id] ? 'Hide' : 'Show'}
                          >
                            {showKeys[apiKey.id] ? (
                              <EyeOff className="w-4 h-4 text-gray-600" />
                            ) : (
                              <Eye className="w-4 h-4 text-gray-600" />
                            )}
                          </button>
                          <button
                            onClick={() => copyKey(apiKey.encrypted_key)}
                            className="p-1 hover:bg-gray-200 rounded"
                            title="Copy"
                          >
                            <Copy className="w-4 h-4 text-gray-600" />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleKeyActive(apiKey.id)}
                        className={`px-3 py-1 rounded-lg text-sm ${
                          apiKey.is_active 
                            ? 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                            : 'bg-green-500 hover:bg-green-600 text-white'
                        }`}
                      >
                        {apiKey.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => deleteApiKey(apiKey.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Security Notice */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mt-6">
        <div className="flex gap-3">
          <Shield className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-yellow-800">Security Notice</p>
            <p className="text-yellow-700 mt-1">
              API keys are stored locally in your browser. For production use, consider implementing server-side key management 
              with proper encryption and access controls.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}