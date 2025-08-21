import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../src/lib/supabase-client';

// Store criteria in database for persistence
const DEFAULT_CRITERIA = {
  projects: {
    stage_timeline: ['Must be early-stage Web3 projects', 'Launched in 2024 or later ONLY'],
    funding_raised: ['Less than $500,000 total funding to date'],
    company_size: ['Small startup team of 1-10 people', 'Preference toward smaller teams'],
    exclusions: ['NO projects from large corporations', 'NO Coinbase, Sony, major enterprises', 'NO corporate backing'],
    traction_validation: ['Participation in grant/incubator/accelerator', 'Evidence of traction (users, partnerships)'],
    verification: ['Must have live project URL', 'Social media presence (especially Twitter/X)', 'Real, independently operating project', 'NO vaporware or abandoned efforts']
  },
  funding: {
    accepted_types: ['Grant programs', 'Incubators', 'Accelerators', 'Early-stage Web3 VCs (seed/pre-seed)'],
    requirements: ['Must be currently ACTIVE', 'NOT dormant or outdated', 'Evidence of 2025 activity required', 'Recent announcements/investments'],
    flexibility: ['Different structures accepted', 'Grants vs accelerators vs VC', 'Key: verifiable activity & relevance']
  },
  resources: {
    usefulness: ['Clear value to early-stage Web3 founders', 'Must be actionable and practical'],
    types: ['Infrastructure (dev tools, APIs, hosting)', 'Educational (courses, docs, learning)', 'Tools (productivity, analytics, design)', 'Communities (support networks, groups)'],
    accessibility: ['Can be free or paid', 'Must be relevant to early-stage builders', 'Usable by founders in building phase']
  }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { action, password } = req.query;
  
  // Simple password protection for admin panel
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'accelerate2025';
  
  if (req.method === 'POST') {
    // Handle criteria updates
    if (req.body.password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    if (req.body.action === 'update_criteria') {
      // Save updated criteria to database
      const { criteria } = req.body;
      
      // Store in a settings table
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          key: 'approval_criteria',
          value: criteria,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
      
      if (error) {
        // Create table if it doesn't exist
        await supabase.rpc('create_settings_table');
        return res.status(200).json({ message: 'Settings table created, please retry' });
      }
      
      return res.status(200).json({ success: true, message: 'Criteria updated successfully' });
    }
    
    if (req.body.action === 'manual_fetch') {
      // Trigger manual fetch
      const response = await fetch(`https://${req.headers.host}/api/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: req.body.source })
      });
      
      return res.status(200).json({ success: true, message: 'Fetch triggered' });
    }
    
    if (req.body.action === 'bulk_action') {
      const { items, actionType } = req.body;
      
      // Bulk approve/reject
      for (const item of items) {
        const table = item.type === 'project' ? 'projects' : 
                     item.type === 'funding' ? 'funding_programs' : 'resources';
        
        await supabase
          .from(table)
          .update({ 
            status: actionType, 
            [`${actionType}_at`]: new Date().toISOString() 
          })
          .eq('id', item.id);
      }
      
      return res.status(200).json({ success: true, message: `Bulk ${actionType} completed` });
    }
  }
  
  // Fetch current criteria from database or use defaults
  const { data: settingsData } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'approval_criteria')
    .single();
  
  const currentCriteria = settingsData?.value || DEFAULT_CRITERIA;
  
  // Get statistics
  const [projectStats, fundingStats, resourceStats] = await Promise.all([
    supabase.from('projects').select('status', { count: 'exact' }),
    supabase.from('funding_programs').select('status', { count: 'exact' }),
    supabase.from('resources').select('status', { count: 'exact' })
  ]);
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Accelerate Admin Control Panel</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
        }
        .container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background: white;
          border-radius: 12px;
          padding: 30px;
          margin-bottom: 30px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.1);
        }
        .header h1 {
          color: #333;
          font-size: 32px;
          margin-bottom: 10px;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
          margin-top: 20px;
        }
        .stat-card {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 20px;
          border-radius: 8px;
          text-align: center;
        }
        .stat-card h3 {
          font-size: 28px;
          margin-bottom: 5px;
        }
        .control-section {
          background: white;
          border-radius: 12px;
          padding: 30px;
          margin-bottom: 20px;
          box-shadow: 0 5px 20px rgba(0,0,0,0.1);
        }
        .section-title {
          font-size: 24px;
          color: #333;
          margin-bottom: 20px;
          border-bottom: 2px solid #667eea;
          padding-bottom: 10px;
        }
        .criteria-editor {
          background: #f8f9fa;
          border: 1px solid #dee2e6;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
        }
        .criteria-category {
          margin-bottom: 25px;
        }
        .criteria-category h4 {
          color: #667eea;
          margin-bottom: 10px;
          font-size: 18px;
        }
        .criteria-input {
          width: 100%;
          padding: 10px;
          margin-bottom: 10px;
          border: 1px solid #ced4da;
          border-radius: 4px;
          font-size: 14px;
        }
        .criteria-textarea {
          width: 100%;
          min-height: 100px;
          padding: 10px;
          border: 1px solid #ced4da;
          border-radius: 4px;
          font-family: inherit;
          font-size: 14px;
          resize: vertical;
        }
        .button-group {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        .button {
          padding: 12px 24px;
          border: none;
          border-radius: 6px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
        }
        .button-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }
        .button-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 5px 20px rgba(102, 126, 234, 0.4);
        }
        .button-success {
          background: #48bb78;
          color: white;
        }
        .button-danger {
          background: #f56565;
          color: white;
        }
        .button-secondary {
          background: #718096;
          color: white;
        }
        .auth-modal {
          display: ${password === ADMIN_PASSWORD ? 'none' : 'flex'};
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.8);
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .auth-box {
          background: white;
          padding: 40px;
          border-radius: 12px;
          width: 400px;
        }
        .auth-input {
          width: 100%;
          padding: 12px;
          margin: 20px 0;
          border: 2px solid #667eea;
          border-radius: 6px;
          font-size: 16px;
        }
        .fetch-controls {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 15px;
        }
        .fetch-source {
          background: #f8f9fa;
          padding: 15px;
          border-radius: 8px;
          border: 2px solid transparent;
          transition: all 0.3s;
        }
        .fetch-source:hover {
          border-color: #667eea;
        }
        .fetch-source h5 {
          color: #333;
          margin-bottom: 5px;
        }
        .fetch-source p {
          color: #666;
          font-size: 14px;
          margin-bottom: 10px;
        }
        .activity-log {
          background: #f8f9fa;
          border-radius: 8px;
          padding: 20px;
          max-height: 400px;
          overflow-y: auto;
        }
        .log-entry {
          padding: 10px;
          margin-bottom: 10px;
          background: white;
          border-radius: 4px;
          border-left: 4px solid #667eea;
        }
        .settings-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }
        .setting-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 15px;
          background: #f8f9fa;
          border-radius: 8px;
        }
        .toggle {
          width: 50px;
          height: 25px;
          background: #cbd5e0;
          border-radius: 25px;
          position: relative;
          cursor: pointer;
          transition: all 0.3s;
        }
        .toggle.active {
          background: #667eea;
        }
        .toggle-handle {
          width: 20px;
          height: 20px;
          background: white;
          border-radius: 50%;
          position: absolute;
          top: 2.5px;
          left: 2.5px;
          transition: all 0.3s;
        }
        .toggle.active .toggle-handle {
          left: 27.5px;
        }
      </style>
    </head>
    <body>
      <!-- Auth Modal -->
      <div class="auth-modal" id="authModal">
        <div class="auth-box">
          <h2>Admin Authentication Required</h2>
          <input type="password" class="auth-input" id="passwordInput" placeholder="Enter admin password">
          <button class="button button-primary" style="width: 100%;" onclick="authenticate()">
            Access Control Panel
          </button>
        </div>
      </div>
      
      <div class="container">
        <div class="header">
          <h1>🎛️ Accelerate Admin Control Panel</h1>
          <p style="color: #666; font-size: 18px;">Complete control over content approval criteria and system settings</p>
          
          <div class="stats-grid">
            <div class="stat-card">
              <h3>${projectStats.count || 0}</h3>
              <p>Total Projects</p>
            </div>
            <div class="stat-card">
              <h3>${fundingStats.count || 0}</h3>
              <p>Funding Programs</p>
            </div>
            <div class="stat-card">
              <h3>${resourceStats.count || 0}</h3>
              <p>Resources</p>
            </div>
            <div class="stat-card">
              <h3>${(projectStats.data?.filter((p: any) => p.status === 'approved').length || 0)}</h3>
              <p>Approved Items</p>
            </div>
          </div>
        </div>
        
        <!-- Criteria Editor Section -->
        <div class="control-section">
          <h2 class="section-title">📋 Edit Approval Criteria</h2>
          
          <div class="criteria-editor">
            <div class="criteria-category">
              <h4>🚀 Project Criteria</h4>
              <textarea class="criteria-textarea" id="projectCriteria" placeholder="Enter project criteria, one per line">${JSON.stringify(currentCriteria.projects, null, 2)}</textarea>
            </div>
            
            <div class="criteria-category">
              <h4>💰 Funding Criteria</h4>
              <textarea class="criteria-textarea" id="fundingCriteria" placeholder="Enter funding criteria, one per line">${JSON.stringify(currentCriteria.funding, null, 2)}</textarea>
            </div>
            
            <div class="criteria-category">
              <h4>📚 Resource Criteria</h4>
              <textarea class="criteria-textarea" id="resourceCriteria" placeholder="Enter resource criteria, one per line">${JSON.stringify(currentCriteria.resources, null, 2)}</textarea>
            </div>
            
            <div class="button-group">
              <button class="button button-success" onclick="saveCriteria()">
                💾 Save Criteria Changes
              </button>
              <button class="button button-secondary" onclick="resetCriteria()">
                ↩️ Reset to Defaults
              </button>
            </div>
          </div>
        </div>
        
        <!-- Manual Fetch Controls -->
        <div class="control-section">
          <h2 class="section-title">🔄 Manual Data Fetching</h2>
          
          <div class="fetch-controls">
            <div class="fetch-source">
              <h5>GitHub</h5>
              <p>Fetch from GitHub trending</p>
              <button class="button button-primary" onclick="manualFetch('github')">
                Fetch Now
              </button>
            </div>
            
            <div class="fetch-source">
              <h5>Product Hunt</h5>
              <p>Today's launches</p>
              <button class="button button-primary" onclick="manualFetch('producthunt')">
                Fetch Now
              </button>
            </div>
            
            <div class="fetch-source">
              <h5>Twitter/X</h5>
              <p>Web3 announcements</p>
              <button class="button button-primary" onclick="manualFetch('twitter')">
                Fetch Now
              </button>
            </div>
            
            <div class="fetch-source">
              <h5>All Sources</h5>
              <p>Complete system fetch</p>
              <button class="button button-success" onclick="manualFetch('all')">
                Fetch All
              </button>
            </div>
          </div>
        </div>
        
        <!-- Custom Scoring Formula Editor -->
        <div class="control-section">
          <h2 class="section-title">🎯 Custom Scoring Formula</h2>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
            <h3 style="margin-bottom: 15px;">Active Scoring Rules</h3>
            
            <div id="scoring-rules">
              <!-- Rules will be loaded here -->
            </div>
            
            <button class="button button-primary" onclick="addScoringRule()" style="margin-top: 15px;">
              ➕ Add New Rule
            </button>
            
            <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #dee2e6;">
              <h4>Test Your Formula</h4>
              <input type="text" placeholder="Enter Project ID to test" id="test-project-id" style="padding: 10px; border: 1px solid #ced4da; border-radius: 4px; width: 300px;">
              <button class="button button-secondary" onclick="testScoringFormula()">
                🧪 Test Score
              </button>
              <div id="test-results" style="margin-top: 15px;"></div>
            </div>
            
            <div style="margin-top: 20px;">
              <button class="button button-success" onclick="saveScoringFormula()">
                💾 Save Formula Changes
              </button>
              <button class="button button-secondary" onclick="loadDefaultFormula()">
                ↩️ Reset to Default
              </button>
            </div>
          </div>
        </div>
        
        <!-- System Settings -->
        <div class="control-section">
          <h2 class="section-title">⚙️ System Settings</h2>
          
          <div class="settings-grid">
            <div class="setting-item">
              <div>
                <strong>Auto-Approval</strong>
                <p style="color: #666; font-size: 14px;">Automatically approve items scoring 90+</p>
              </div>
              <div class="toggle" onclick="toggleSetting(this)">
                <div class="toggle-handle"></div>
              </div>
            </div>
            
            <div class="setting-item">
              <div>
                <strong>Daily Fetching</strong>
                <p style="color: #666; font-size: 14px;">Run fetchers every 24 hours</p>
              </div>
              <div class="toggle active" onclick="toggleSetting(this)">
                <div class="toggle-handle"></div>
              </div>
            </div>
            
            <div class="setting-item">
              <div>
                <strong>Webhook Notifications</strong>
                <p style="color: #666; font-size: 14px;">Send webhooks for new high-score items</p>
              </div>
              <div class="toggle" onclick="toggleSetting(this)">
                <div class="toggle-handle"></div>
              </div>
            </div>
            
            <div class="setting-item">
              <div>
                <strong>Duplicate Detection</strong>
                <p style="color: #666; font-size: 14px;">AI-powered deduplication</p>
              </div>
              <div class="toggle active" onclick="toggleSetting(this)">
                <div class="toggle-handle"></div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Quick Actions -->
        <div class="control-section">
          <h2 class="section-title">⚡ Quick Actions</h2>
          
          <div class="button-group">
            <button class="button button-primary" onclick="window.open('/', '_blank')">
              📊 View Approval Dashboard
            </button>
            <button class="button button-success" onclick="exportData()">
              📥 Export All Data
            </button>
            <button class="button button-secondary" onclick="viewLogs()">
              📜 View System Logs
            </button>
            <button class="button button-danger" onclick="clearRejected()">
              🗑️ Clear Rejected Items
            </button>
          </div>
        </div>
        
        <!-- Activity Log -->
        <div class="control-section">
          <h2 class="section-title">📊 Recent Activity</h2>
          
          <div class="activity-log" id="activityLog">
            <div class="log-entry">
              <strong>System Ready</strong> - Admin panel loaded successfully
              <span style="float: right; color: #666; font-size: 12px;">${new Date().toLocaleTimeString()}</span>
            </div>
          </div>
        </div>
      </div>
      
      <script>
        const ADMIN_PASSWORD = '${ADMIN_PASSWORD}';
        
        function authenticate() {
          const password = document.getElementById('passwordInput').value;
          if (password === ADMIN_PASSWORD) {
            document.getElementById('authModal').style.display = 'none';
            addLog('Admin authenticated successfully');
          } else {
            alert('Invalid password');
          }
        }
        
        async function saveCriteria() {
          const criteria = {
            projects: JSON.parse(document.getElementById('projectCriteria').value),
            funding: JSON.parse(document.getElementById('fundingCriteria').value),
            resources: JSON.parse(document.getElementById('resourceCriteria').value)
          };
          
          const response = await fetch('/api/admin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'update_criteria',
              password: ADMIN_PASSWORD,
              criteria: criteria
            })
          });
          
          const result = await response.json();
          if (result.success) {
            addLog('Criteria updated successfully');
            alert('Criteria saved successfully!');
          }
        }
        
        function resetCriteria() {
          if (confirm('Reset all criteria to defaults?')) {
            location.reload();
          }
        }
        
        async function manualFetch(source) {
          addLog('Triggering manual fetch from ' + source);
          
          const response = await fetch('/api/admin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'manual_fetch',
              password: ADMIN_PASSWORD,
              source: source
            })
          });
          
          if (response.ok) {
            addLog('Fetch triggered for ' + source);
            alert('Fetch started for ' + source);
          }
        }
        
        function toggleSetting(element) {
          element.classList.toggle('active');
          const settingName = element.parentElement.querySelector('strong').textContent;
          addLog('Setting toggled: ' + settingName);
        }
        
        function exportData() {
          addLog('Exporting all data...');
          window.open('/api/export', '_blank');
        }
        
        function viewLogs() {
          addLog('Opening system logs...');
          window.open('/api/logs', '_blank');
        }
        
        async function clearRejected() {
          if (confirm('Clear all rejected items? This cannot be undone.')) {
            addLog('Clearing rejected items...');
            // Implementation here
          }
        }
        
        function addLog(message) {
          const log = document.getElementById('activityLog');
          const entry = document.createElement('div');
          entry.className = 'log-entry';
          entry.innerHTML = \`
            <strong>\${message}</strong>
            <span style="float: right; color: #666; font-size: 12px;">\${new Date().toLocaleTimeString()}</span>
          \`;
          log.insertBefore(entry, log.firstChild);
        }
        
        // Auto-authenticate if password in URL
        if (window.location.search.includes('password=${ADMIN_PASSWORD}')) {
          document.getElementById('authModal').style.display = 'none';
        }
        
        // Scoring formula management
        let scoringFormula = null;
        
        async function loadScoringFormula() {
          try {
            const response = await fetch('/api/scoring');
            scoringFormula = await response.json();
            displayScoringRules();
          } catch (error) {
            console.error('Failed to load scoring formula:', error);
          }
        }
        
        function displayScoringRules() {
          const container = document.getElementById('scoring-rules');
          if (!scoringFormula || !scoringFormula.rules) return;
          
          container.innerHTML = scoringFormula.rules.map((rule, index) => \`
            <div style="background: white; padding: 15px; border-radius: 6px; margin-bottom: 10px; border: 1px solid #e5e7eb;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="flex: 1;">
                  <strong>\${rule.name}</strong>
                  <div style="margin-top: 10px; display: flex; gap: 10px; align-items: center;">
                    <select id="field-\${index}" style="padding: 5px;">
                      <option value="amount_funded" \${rule.field === 'amount_funded' ? 'selected' : ''}>Funding Amount</option>
                      <option value="team_size" \${rule.field === 'team_size' ? 'selected' : ''}>Team Size</option>
                      <option value="launched_date" \${rule.field === 'launched_date' ? 'selected' : ''}>Launch Date</option>
                      <option value="social_score" \${rule.field === 'social_score' ? 'selected' : ''}>Social Score</option>
                      <option value="github_stars" \${rule.field === 'github_stars' ? 'selected' : ''}>GitHub Stars</option>
                      <option value="twitter_followers" \${rule.field === 'twitter_followers' ? 'selected' : ''}>Twitter Followers</option>
                    </select>
                    
                    <select id="operator-\${index}" style="padding: 5px;">
                      <option value="greater" \${rule.operator === 'greater' ? 'selected' : ''}>&gt;</option>
                      <option value="less" \${rule.operator === 'less' ? 'selected' : ''}>&lt;</option>
                      <option value="equals" \${rule.operator === 'equals' ? 'selected' : ''}>=</option>
                      <option value="between" \${rule.operator === 'between' ? 'selected' : ''}>between</option>
                    </select>
                    
                    <input type="text" id="value-\${index}" value="\${Array.isArray(rule.value) ? rule.value.join(',') : rule.value}" style="padding: 5px; width: 150px;">
                    
                    <span>→</span>
                    
                    <input type="number" id="points-\${index}" value="\${rule.points}" style="padding: 5px; width: 60px;" min="0" max="100">
                    <span>points</span>
                    
                    <span>×</span>
                    
                    <input type="number" id="weight-\${index}" value="\${rule.weight}" step="0.1" style="padding: 5px; width: 60px;" min="0.1" max="2">
                    <span>weight</span>
                    
                    <label style="margin-left: 10px;">
                      <input type="checkbox" id="enabled-\${index}" \${rule.enabled ? 'checked' : ''}>
                      Enabled
                    </label>
                  </div>
                </div>
                <button onclick="removeRule(\${index})" style="background: #ef4444; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">
                  Remove
                </button>
              </div>
            </div>
          \`).join('');
        }
        
        function addScoringRule() {
          if (!scoringFormula) {
            scoringFormula = { rules: [] };
          }
          
          scoringFormula.rules.push({
            id: Date.now().toString(),
            name: 'New Rule',
            field: 'amount_funded',
            operator: 'greater',
            value: 0,
            points: 10,
            weight: 1,
            enabled: true
          });
          
          displayScoringRules();
        }
        
        function removeRule(index) {
          scoringFormula.rules.splice(index, 1);
          displayScoringRules();
        }
        
        async function saveScoringFormula() {
          // Collect current values from inputs
          scoringFormula.rules = scoringFormula.rules.map((rule, index) => ({
            ...rule,
            field: document.getElementById('field-' + index).value,
            operator: document.getElementById('operator-' + index).value,
            value: document.getElementById('operator-' + index).value === 'between' 
              ? document.getElementById('value-' + index).value.split(',').map(v => parseFloat(v))
              : parseFloat(document.getElementById('value-' + index).value),
            points: parseInt(document.getElementById('points-' + index).value),
            weight: parseFloat(document.getElementById('weight-' + index).value),
            enabled: document.getElementById('enabled-' + index).checked
          }));
          
          try {
            const response = await fetch('/api/scoring', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ formula: scoringFormula })
            });
            
            const result = await response.json();
            if (result.success) {
              addLog('Scoring formula saved successfully');
              alert('Formula saved! All new items will be scored with this formula.');
            }
          } catch (error) {
            alert('Failed to save formula: ' + error.message);
          }
        }
        
        async function testScoringFormula() {
          const testId = document.getElementById('test-project-id').value;
          if (!testId) {
            alert('Please enter a project ID to test');
            return;
          }
          
          try {
            const response = await fetch('/api/scoring', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                itemId: testId, 
                formula: scoringFormula 
              })
            });
            
            const result = await response.json();
            
            document.getElementById('test-results').innerHTML = \`
              <div style="background: white; padding: 15px; border-radius: 6px; border: 2px solid #10b981;">
                <h4>Score: \${result.score}/100</h4>
                <div style="margin-top: 10px;">
                  \${result.breakdown.map(b => \`
                    <div style="padding: 5px; \${b.matched ? 'color: green;' : 'color: gray;'}">
                      \${b.matched ? '✓' : '✗'} \${b.rule}: \${b.points} points
                    </div>
                  \`).join('')}
                </div>
              </div>
            \`;
          } catch (error) {
            alert('Failed to test formula: ' + error.message);
          }
        }
        
        function loadDefaultFormula() {
          if (confirm('Reset to default formula? Your custom rules will be lost.')) {
            loadScoringFormula();
          }
        }
        
        // Load formula on page load
        loadScoringFormula();
      </script>
    </body>
    </html>
  `;
  
  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(html);
}