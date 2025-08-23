import { useState, useEffect } from 'react'
import { Save, Plus, X, Key, AlertCircle } from 'lucide-react'

interface ContentSettings {
  minScore: number
  minDescription: number
  qualityThreshold: number
  autoApproveScore: number
  keywords: string[]
  blockedDomains: string[]
  enrichmentOptions: {
    aiAnalysis: boolean
    sentiment: boolean
    keywords: boolean
    category: boolean
    summary: boolean
  }
}

export default function Settings() {
  const [settings, setSettings] = useState<ContentSettings>({
    minScore: 50,
    minDescription: 50,
    qualityThreshold: 70,
    autoApproveScore: 85,
    keywords: [],
    blockedDomains: [],
    enrichmentOptions: {
      aiAnalysis: true,
      sentiment: false,
      keywords: false,
      category: false,
      summary: false,
    },
  })

  const [keywordInput, setKeywordInput] = useState('')
  const [domainInput, setDomainInput] = useState('')
  const [openaiKey, setOpenaiKey] = useState('')
  const [saved, setSaved] = useState(false)
  const [keyVisible, setKeyVisible] = useState(false)

  useEffect(() => {
    const savedSettings = localStorage.getItem('contentSettings')
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings))
    }
    
    const savedKey = localStorage.getItem('openai_api_key')
    if (savedKey) {
      setOpenaiKey(savedKey)
    }
  }, [])

  const handleSave = () => {
    localStorage.setItem('contentSettings', JSON.stringify(settings))
    if (openaiKey) {
      localStorage.setItem('openai_api_key', openaiKey)
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const addKeyword = () => {
    if (keywordInput.trim() && !settings.keywords.includes(keywordInput.trim())) {
      setSettings({
        ...settings,
        keywords: [...settings.keywords, keywordInput.trim()],
      })
      setKeywordInput('')
    }
  }

  const removeKeyword = (index: number) => {
    setSettings({
      ...settings,
      keywords: settings.keywords.filter((_, i) => i !== index),
    })
  }

  const addDomain = () => {
    if (domainInput.trim() && !settings.blockedDomains.includes(domainInput.trim())) {
      setSettings({
        ...settings,
        blockedDomains: [...settings.blockedDomains, domainInput.trim()],
      })
      setDomainInput('')
    }
  }

  const removeDomain = (index: number) => {
    setSettings({
      ...settings,
      blockedDomains: settings.blockedDomains.filter((_, i) => i !== index),
    })
  }

  return (
    <div className="bg-white rounded-xl p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Content Settings</h1>
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Save className="w-4 h-4" />
          {saved ? 'Saved!' : 'Save Settings'}
        </button>
      </div>

      <div className="space-y-6">
        {/* OpenAI API Key */}
        <div className="border-b border-gray-200 pb-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Key className="w-5 h-5" />
            OpenAI API Configuration
          </h2>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-semibold">GPT-4 Integration</p>
                <p>Add your OpenAI API key to enable advanced content enrichment with GPT-4. This will provide:</p>
                <ul className="list-disc list-inside mt-1">
                  <li>AI-powered content analysis</li>
                  <li>Quality assessment and insights</li>
                  <li>Automatic categorization</li>
                  <li>Smart summaries and keyword extraction</li>
                </ul>
              </div>
            </div>
          </div>
          
          <div className="flex gap-2">
            <input
              type={keyVisible ? 'text' : 'password'}
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
              placeholder="sk-..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary"
            />
            <button
              onClick={() => setKeyVisible(!keyVisible)}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              {keyVisible ? 'Hide' : 'Show'}
            </button>
          </div>
          
          {!openaiKey && (
            <p className="text-sm text-gray-500 mt-2">
              Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">OpenAI Platform</a>
            </p>
          )}
        </div>
        
        {/* Score Settings */}
        <div className="border-b border-gray-200 pb-6">
          <h2 className="text-lg font-semibold mb-4">Score Thresholds</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Minimum Content Score: {settings.minScore}
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={settings.minScore}
                onChange={(e) => setSettings({ ...settings, minScore: Number(e.target.value) })}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Minimum Description Length: {settings.minDescription} chars
              </label>
              <input
                type="range"
                min="10"
                max="500"
                step="10"
                value={settings.minDescription}
                onChange={(e) => setSettings({ ...settings, minDescription: Number(e.target.value) })}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quality Threshold: {settings.qualityThreshold}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={settings.qualityThreshold}
                onChange={(e) => setSettings({ ...settings, qualityThreshold: Number(e.target.value) })}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Auto-Approve Score: {settings.autoApproveScore}
              </label>
              <input
                type="range"
                min="50"
                max="100"
                value={settings.autoApproveScore}
                onChange={(e) => setSettings({ ...settings, autoApproveScore: Number(e.target.value) })}
                className="w-full"
              />
            </div>
          </div>
        </div>

        {/* Keywords */}
        <div className="border-b border-gray-200 pb-6">
          <h2 className="text-lg font-semibold mb-4">Required Keywords</h2>
          
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addKeyword()}
              placeholder="Add keyword..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary"
            />
            <button
              onClick={addKeyword}
              className="px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {settings.keywords.map((keyword, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-full"
              >
                {keyword}
                <button
                  onClick={() => removeKeyword(index)}
                  className="text-gray-500 hover:text-red-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Blocked Domains */}
        <div className="border-b border-gray-200 pb-6">
          <h2 className="text-lg font-semibold mb-4">Blocked Domains</h2>
          
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={domainInput}
              onChange={(e) => setDomainInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addDomain()}
              placeholder="Add domain to block..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary"
            />
            <button
              onClick={addDomain}
              className="px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-2">
            {settings.blockedDomains.map((domain, index) => (
              <div
                key={index}
                className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg"
              >
                <span className="text-gray-700">{domain}</span>
                <button
                  onClick={() => removeDomain(index)}
                  className="text-gray-500 hover:text-red-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Enrichment Options */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Enrichment Options</h2>
          
          <div className="space-y-3">
            {Object.entries(settings.enrichmentOptions).map(([key, value]) => (
              <label key={key} className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      enrichmentOptions: {
                        ...settings.enrichmentOptions,
                        [key]: e.target.checked,
                      },
                    })
                  }
                  className="w-5 h-5 text-primary rounded focus:ring-primary"
                />
                <span className="text-gray-700 capitalize">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}