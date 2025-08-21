import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../src/lib/supabase-client';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle POST requests for approve/reject actions
  if (req.method === 'POST') {
    const { action, type, id } = req.body;
    
    if (action === 'approve') {
      // Update item as approved in database
      const table = type === 'project' ? 'projects' : type === 'funding' ? 'funding_programs' : 'resources';
      const { error } = await supabase
        .from(table)
        .update({ status: 'approved', approved_at: new Date().toISOString() })
        .eq('id', id);
      
      if (error) {
        return res.status(500).json({ error: 'Failed to approve item' });
      }
      return res.status(200).json({ success: true, message: 'Item approved' });
    }
    
    if (action === 'reject') {
      // Update item as rejected in database
      const table = type === 'project' ? 'projects' : type === 'funding' ? 'funding_programs' : 'resources';
      const { error } = await supabase
        .from(table)
        .update({ status: 'rejected', rejected_at: new Date().toISOString() })
        .eq('id', id);
      
      if (error) {
        return res.status(500).json({ error: 'Failed to reject item' });
      }
      return res.status(200).json({ success: true, message: 'Item rejected' });
    }
  }

  // Fetch real data from database - only pending items
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [projectsRes, fundingRes, resourcesRes, approvedRes] = await Promise.all([
    supabase
      .from('projects')
      .select('*')
      .or('status.is.null,status.eq.pending')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('score', { ascending: false })
      .limit(50),
    
    supabase
      .from('funding_programs')
      .select('*')
      .or('status.is.null,status.eq.pending,status.eq.open')
      .order('created_at', { ascending: false })
      .limit(50),
    
    supabase
      .from('resources')
      .select('*')
      .or('status.is.null,status.eq.pending')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('score', { ascending: false })
      .limit(50),
      
    // Get recently approved items
    supabase
      .from('projects')
      .select('*')
      .eq('status', 'approved')
      .order('approved_at', { ascending: false })
      .limit(10),
  ]);

  const projects = projectsRes.data || [];
  const funding = fundingRes.data || [];
  const resources = resourcesRes.data || [];
  const approved = approvedRes.data || [];

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Accelerate Content Approval System</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: #f5f5f5;
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 20px;
          position: sticky;
          top: 0;
          z-index: 100;
        }
        .header h1 {
          font-size: 24px;
          margin-bottom: 10px;
        }
        .stats {
          display: flex;
          gap: 20px;
          margin-top: 10px;
        }
        .stat {
          background: rgba(255,255,255,0.2);
          padding: 10px 20px;
          border-radius: 8px;
        }
        .tabs {
          display: flex;
          background: white;
          border-bottom: 2px solid #e5e5e5;
          position: sticky;
          top: 80px;
          z-index: 90;
        }
        .tab {
          padding: 15px 30px;
          cursor: pointer;
          border: none;
          background: none;
          font-size: 16px;
          font-weight: 500;
          color: #666;
          transition: all 0.3s;
        }
        .tab.active {
          color: #667eea;
          border-bottom: 3px solid #667eea;
        }
        .tab:hover {
          background: #f9f9f9;
        }
        .content {
          max-width: 1400px;
          margin: 0 auto;
          padding: 20px;
        }
        .filters {
          background: white;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 20px;
          display: flex;
          gap: 15px;
          align-items: center;
        }
        .filter-label {
          font-weight: 500;
          color: #555;
        }
        .filter-button {
          padding: 8px 16px;
          border: 2px solid #e5e5e5;
          background: white;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .filter-button:hover {
          border-color: #667eea;
        }
        .filter-button.active {
          background: #667eea;
          color: white;
          border-color: #667eea;
        }
        .items-grid {
          display: grid;
          gap: 20px;
        }
        .item-card {
          background: white;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          transition: all 0.3s;
        }
        .item-card:hover {
          box-shadow: 0 4px 20px rgba(0,0,0,0.12);
          transform: translateY(-2px);
        }
        .item-header {
          display: flex;
          justify-content: space-between;
          align-items: start;
          margin-bottom: 15px;
        }
        .item-title {
          font-size: 18px;
          font-weight: 600;
          color: #333;
          text-decoration: none;
          flex: 1;
        }
        .item-title:hover {
          color: #667eea;
        }
        .item-badge {
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
        }
        .badge-project {
          background: #e3f2fd;
          color: #1976d2;
        }
        .badge-funding {
          background: #e8f5e9;
          color: #388e3c;
        }
        .badge-resource {
          background: #fff3e0;
          color: #f57c00;
        }
        .item-description {
          color: #666;
          line-height: 1.6;
          margin-bottom: 15px;
        }
        .item-meta {
          display: flex;
          gap: 20px;
          flex-wrap: wrap;
          padding-top: 15px;
          border-top: 1px solid #f0f0f0;
        }
        .meta-item {
          display: flex;
          align-items: center;
          gap: 5px;
          color: #888;
          font-size: 14px;
        }
        .item-actions {
          display: flex;
          gap: 10px;
          margin-top: 15px;
        }
        .action-button {
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s;
        }
        .approve-button {
          background: #48bb78;
          color: white;
        }
        .approve-button:hover {
          background: #38a169;
        }
        .reject-button {
          background: #f56565;
          color: white;
        }
        .reject-button:hover {
          background: #e53e3e;
        }
        .view-button {
          background: #667eea;
          color: white;
        }
        .view-button:hover {
          background: #5a67d8;
        }
        .tab-content {
          display: none;
        }
        .tab-content.active {
          display: block;
        }
        .empty-state {
          text-align: center;
          padding: 60px 20px;
          color: #888;
        }
        .empty-state h3 {
          font-size: 20px;
          margin-bottom: 10px;
          color: #555;
        }
        .score-badge {
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          padding: 4px 10px;
          border-radius: 4px;
          font-weight: 600;
          font-size: 14px;
        }
        .tags {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 10px;
        }
        .tag {
          padding: 4px 10px;
          background: #f0f0f0;
          border-radius: 4px;
          font-size: 12px;
          color: #666;
        }
        .criteria-section {
          background: #fffef0;
          border: 2px solid #f59e0b;
          border-radius: 8px;
          padding: 20px;
          margin: 20px;
        }
        .criteria-title {
          font-size: 20px;
          font-weight: 700;
          color: #d97706;
          margin-bottom: 15px;
        }
        .criteria-list {
          list-style: none;
        }
        .criteria-item {
          padding: 10px 0;
          border-bottom: 1px solid #fed7aa;
          color: #92400e;
          font-weight: 500;
        }
        .criteria-item:last-child {
          border-bottom: none;
        }
        .workflow-section {
          background: #f0f9ff;
          border: 2px solid #0284c7;
          border-radius: 8px;
          padding: 20px;
          margin: 20px;
        }
        .workflow-title {
          font-size: 18px;
          font-weight: 700;
          color: #0c4a6e;
          margin-bottom: 15px;
        }
        .workflow-steps {
          display: flex;
          gap: 10px;
          align-items: center;
          color: #075985;
        }
        .workflow-step {
          padding: 8px 16px;
          background: white;
          border: 2px solid #0284c7;
          border-radius: 6px;
          font-weight: 600;
        }
        .arrow {
          font-size: 20px;
          color: #0284c7;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🎯 Accelerate Content Approval System</h1>
        <p style="font-size: 18px; margin-top: 10px;">Review fetched content and approve what meets our STRICT criteria for the Accelerate platform</p>
        <div class="stats">
          <div class="stat">
            <strong>${projects.length}</strong> Projects to Review
          </div>
          <div class="stat">
            <strong>${funding.length}</strong> Funding Programs
          </div>
          <div class="stat">
            <strong>${resources.length}</strong> Resources
          </div>
          <div class="stat">
            <strong>${approved.length}</strong> Recently Approved
          </div>
        </div>
      </div>

      <!-- Workflow Explanation -->
      <div class="workflow-section">
        <div class="workflow-title">How This Works:</div>
        <div class="workflow-steps">
          <div class="workflow-step">1. Fetchers Collect Data</div>
          <span class="arrow">→</span>
          <div class="workflow-step">2. You Review Here</div>
          <span class="arrow">→</span>
          <div class="workflow-step">3. Approve/Reject</div>
          <span class="arrow">→</span>
          <div class="workflow-step">4. Shows on Accelerate Platform</div>
        </div>
      </div>

      <!-- DETAILED CRITERIA SECTION -->
      <div class="criteria-section">
        <div class="criteria-title">📋 STRICT APPROVAL CRITERIA - ONLY APPROVE IF ALL REQUIREMENTS MET:</div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 25px; margin-top: 20px;">
          <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #fed7aa;">
            <h3 style="color: #d97706; margin-bottom: 15px; font-size: 18px;">🚀 CRITERIA FOR PROJECTS</h3>
            
            <div style="margin-bottom: 15px;">
              <h4 style="color: #92400e; font-size: 14px; margin-bottom: 8px;">Stage & Timeline:</h4>
              <ul class="criteria-list">
                <li class="criteria-item" style="padding: 5px 0;">✓ Must be early-stage Web3 projects</li>
                <li class="criteria-item" style="padding: 5px 0;">✓ Launched in 2024 or later ONLY</li>
              </ul>
            </div>
            
            <div style="margin-bottom: 15px;">
              <h4 style="color: #92400e; font-size: 14px; margin-bottom: 8px;">Funding Raised:</h4>
              <ul class="criteria-list">
                <li class="criteria-item" style="padding: 5px 0;">✓ Less than $500,000 total funding to date</li>
              </ul>
            </div>
            
            <div style="margin-bottom: 15px;">
              <h4 style="color: #92400e; font-size: 14px; margin-bottom: 8px;">Company Size:</h4>
              <ul class="criteria-list">
                <li class="criteria-item" style="padding: 5px 0;">✓ Small startup team of 1-10 people</li>
                <li class="criteria-item" style="padding: 5px 0;">✓ Preference toward smaller teams</li>
              </ul>
            </div>
            
            <div style="margin-bottom: 15px;">
              <h4 style="color: #92400e; font-size: 14px; margin-bottom: 8px;">Exclusions:</h4>
              <ul class="criteria-list">
                <li class="criteria-item" style="padding: 5px 0;">❌ NO projects from large corporations</li>
                <li class="criteria-item" style="padding: 5px 0;">❌ NO Coinbase, Sony, major enterprises</li>
                <li class="criteria-item" style="padding: 5px 0;">❌ NO corporate backing</li>
              </ul>
            </div>
            
            <div style="margin-bottom: 15px;">
              <h4 style="color: #92400e; font-size: 14px; margin-bottom: 8px;">Traction & Validation (Preferred):</h4>
              <ul class="criteria-list">
                <li class="criteria-item" style="padding: 5px 0;">⭐ Participation in grant/incubator/accelerator</li>
                <li class="criteria-item" style="padding: 5px 0;">⭐ Evidence of traction (users, partnerships)</li>
              </ul>
            </div>
            
            <div>
              <h4 style="color: #92400e; font-size: 14px; margin-bottom: 8px;">Verification of Legitimacy:</h4>
              <ul class="criteria-list">
                <li class="criteria-item" style="padding: 5px 0;">✓ Must have live project URL</li>
                <li class="criteria-item" style="padding: 5px 0;">✓ Social media presence (especially Twitter/X)</li>
                <li class="criteria-item" style="padding: 5px 0;">✓ Real, independently operating project</li>
                <li class="criteria-item" style="padding: 5px 0;">❌ NO vaporware or abandoned efforts</li>
              </ul>
            </div>
          </div>
          
          <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #fed7aa;">
            <h3 style="color: #d97706; margin-bottom: 15px; font-size: 18px;">💰 CRITERIA FOR FUNDING</h3>
            
            <div style="margin-bottom: 15px;">
              <h4 style="color: #92400e; font-size: 14px; margin-bottom: 8px;">Accepted Types:</h4>
              <ul class="criteria-list">
                <li class="criteria-item" style="padding: 5px 0;">✓ Grant programs</li>
                <li class="criteria-item" style="padding: 5px 0;">✓ Incubators</li>
                <li class="criteria-item" style="padding: 5px 0;">✓ Accelerators</li>
                <li class="criteria-item" style="padding: 5px 0;">✓ Early-stage Web3 VCs (seed/pre-seed)</li>
              </ul>
            </div>
            
            <div style="margin-bottom: 15px;">
              <h4 style="color: #92400e; font-size: 14px; margin-bottom: 8px;">Requirements:</h4>
              <ul class="criteria-list">
                <li class="criteria-item" style="padding: 5px 0;">✓ Must be currently ACTIVE</li>
                <li class="criteria-item" style="padding: 5px 0;">✓ NOT dormant or outdated</li>
                <li class="criteria-item" style="padding: 5px 0;">✓ Evidence of 2025 activity required</li>
                <li class="criteria-item" style="padding: 5px 0;">✓ Recent announcements/investments</li>
              </ul>
            </div>
            
            <div>
              <h4 style="color: #92400e; font-size: 14px; margin-bottom: 8px;">Flexibility:</h4>
              <ul class="criteria-list">
                <li class="criteria-item" style="padding: 5px 0;">✓ Different structures accepted</li>
                <li class="criteria-item" style="padding: 5px 0;">✓ Grants vs accelerators vs VC</li>
                <li class="criteria-item" style="padding: 5px 0;">✓ Key: verifiable activity & relevance</li>
              </ul>
            </div>
          </div>
          
          <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #fed7aa;">
            <h3 style="color: #d97706; margin-bottom: 15px; font-size: 18px;">📚 CRITERIA FOR RESOURCES</h3>
            
            <div style="margin-bottom: 15px;">
              <h4 style="color: #92400e; font-size: 14px; margin-bottom: 8px;">Usefulness:</h4>
              <ul class="criteria-list">
                <li class="criteria-item" style="padding: 5px 0;">✓ Clear value to early-stage Web3 founders</li>
                <li class="criteria-item" style="padding: 5px 0;">✓ Must be actionable and practical</li>
              </ul>
            </div>
            
            <div style="margin-bottom: 15px;">
              <h4 style="color: #92400e; font-size: 14px; margin-bottom: 8px;">Types of Resources:</h4>
              <ul class="criteria-list">
                <li class="criteria-item" style="padding: 5px 0;">✓ Infrastructure (dev tools, APIs, hosting)</li>
                <li class="criteria-item" style="padding: 5px 0;">✓ Educational (courses, docs, learning)</li>
                <li class="criteria-item" style="padding: 5px 0;">✓ Tools (productivity, analytics, design)</li>
                <li class="criteria-item" style="padding: 5px 0;">✓ Communities (support networks, groups)</li>
              </ul>
            </div>
            
            <div>
              <h4 style="color: #92400e; font-size: 14px; margin-bottom: 8px;">Accessibility:</h4>
              <ul class="criteria-list">
                <li class="criteria-item" style="padding: 5px 0;">✓ Can be free or paid</li>
                <li class="criteria-item" style="padding: 5px 0;">✓ Must be relevant to early-stage builders</li>
                <li class="criteria-item" style="padding: 5px 0;">✓ Usable by founders in building phase</li>
              </ul>
            </div>
          </div>
        </div>
        
        <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin-top: 20px; border: 2px solid #f59e0b;">
          <h4 style="color: #92400e; margin-bottom: 10px;">⚠️ GENERAL DATA REQUIREMENTS:</h4>
          <ul style="list-style: none; margin: 0;">
            <li style="padding: 5px 0; color: #92400e; font-weight: 600;">• All information must be detailed, explicit, and useful</li>
            <li style="padding: 5px 0; color: #92400e; font-weight: 600;">• BREVITY IS NOT VALUED - Every record should provide full clarity, context, and substance</li>
            <li style="padding: 5px 0; color: #92400e; font-weight: 600;">• Data must be structured and complete across all categories</li>
            <li style="padding: 5px 0; color: #92400e; font-weight: 600;">• Populate ALL available fields with maximum detail (500+ char descriptions)</li>
          </ul>
        </div>
      </div>

      <div class="tabs">
        <button class="tab active" onclick="switchTab('projects')">
          Projects (${projects.length})
        </button>
        <button class="tab" onclick="switchTab('funding')">
          Funding (${funding.length})
        </button>
        <button class="tab" onclick="switchTab('resources')">
          Resources (${resources.length})
        </button>
        <button class="tab" onclick="switchTab('approved')">
          Approved (${approved.length})
        </button>
      </div>

      <div class="content">
        <!-- Projects Tab -->
        <div id="projects" class="tab-content active">
          
          <div class="items-grid">
            ${projects.length > 0 ? projects.map(project => `
              <div class="item-card">
                <div class="item-header">
                  <a href="${project.website_url || project.github_url || '#'}" target="_blank" class="item-title">
                    ${project.name || 'Unnamed Project'}
                  </a>
                  <span class="score-badge">Score: ${project.score || 0}</span>
                </div>
                
                <p class="item-description">
                  ${project.description || 'No description available'}
                </p>
                
                <div class="tags">
                  ${project.categories ? project.categories.map(cat => `<span class="tag">${cat}</span>`).join('') : ''}
                </div>
                
                <div class="item-meta">
                  <span class="meta-item">💰 ${project.amount_funded ? '$' + project.amount_funded.toLocaleString() : 'Not disclosed'}</span>
                  <span class="meta-item">👥 ${project.team_size || 'Unknown'} team members</span>
                  <span class="meta-item">📅 ${project.launched_date ? new Date(project.launched_date).toLocaleDateString() : 'Recent'}</span>
                </div>
                
                <div class="item-actions">
                  <button class="action-button approve-button" onclick="approveItem('project', '${project.id}')">
                    ✅ Approve
                  </button>
                  <button class="action-button reject-button" onclick="rejectItem('project', '${project.id}')">
                    ❌ Reject
                  </button>
                  <a href="${project.website_url || project.github_url || '#'}" target="_blank" class="action-button view-button" style="text-decoration: none;">
                    🔗 View Source
                  </a>
                </div>
              </div>
            `).join('') : '<div class="empty-state"><h3>No new projects</h3><p>Check back later or run a manual fetch</p></div>'}
          </div>
        </div>

        <!-- Funding Tab -->
        <div id="funding" class="tab-content">
          <div class="filters">
            <span class="filter-label">Filter:</span>
            <button class="filter-button active">All</button>
            <button class="filter-button">Closing Soon</button>
            <button class="filter-button">$100k+</button>
            <button class="filter-button">Equity-Free</button>
          </div>
          
          <div class="items-grid">
            ${funding.length > 0 ? funding.map(fund => `
              <div class="item-card">
                <div class="item-header">
                  <a href="${fund.website_url || '#'}" target="_blank" class="item-title">
                    ${fund.name || 'Unnamed Program'}
                  </a>
                  <span class="item-badge badge-funding">${fund.status || 'Open'}</span>
                </div>
                
                <p class="item-description">
                  ${fund.description || 'No description available'}
                </p>
                
                <div class="item-meta">
                  <span class="meta-item">💵 ${fund.funding_amount ? '$' + fund.funding_amount.toLocaleString() : 'Variable'}</span>
                  <span class="meta-item">📍 ${fund.location || 'Global'}</span>
                  <span class="meta-item">⏰ ${fund.deadline ? new Date(fund.deadline).toLocaleDateString() : 'Rolling'}</span>
                </div>
                
                <div class="item-actions">
                  <button class="action-button approve-button" onclick="approveItem('funding', '${fund.id}')">
                    ✅ Approve
                  </button>
                  <button class="action-button reject-button" onclick="rejectItem('funding', '${fund.id}')">
                    ❌ Reject
                  </button>
                  <a href="${fund.application_url || fund.website_url || '#'}" target="_blank" class="action-button view-button" style="text-decoration: none;">
                    📝 Apply Now
                  </a>
                </div>
              </div>
            `).join('') : '<div class="empty-state"><h3>No funding opportunities</h3><p>New opportunities are fetched daily</p></div>'}
          </div>
        </div>

        <!-- Resources Tab -->
        <div id="resources" class="tab-content">
          <div class="filters">
            <span class="filter-label">Filter:</span>
            <button class="filter-button active">All</button>
            <button class="filter-button">Tutorials</button>
            <button class="filter-button">Tools</button>
            <button class="filter-button">Guides</button>
          </div>
          
          <div class="items-grid">
            ${resources.length > 0 ? resources.map(resource => `
              <div class="item-card">
                <div class="item-header">
                  <a href="${resource.url || '#'}" target="_blank" class="item-title">
                    ${resource.title || 'Unnamed Resource'}
                  </a>
                  <span class="item-badge badge-resource">${resource.type || 'Resource'}</span>
                </div>
                
                <p class="item-description">
                  ${resource.description || 'No description available'}
                </p>
                
                <div class="tags">
                  ${resource.tags ? resource.tags.map(tag => `<span class="tag">${tag}</span>`).join('') : ''}
                </div>
                
                <div class="item-meta">
                  <span class="meta-item">✍️ ${resource.author || 'Unknown'}</span>
                  <span class="meta-item">📅 ${resource.updated_at ? new Date(resource.updated_at).toLocaleDateString() : 'Recent'}</span>
                  <span class="meta-item">⭐ Score: ${resource.score || 0}</span>
                </div>
                
                <div class="item-actions">
                  <button class="action-button approve-button" onclick="approveItem('resource', '${resource.id}')">
                    ✅ Approve
                  </button>
                  <button class="action-button reject-button" onclick="rejectItem('resource', '${resource.id}')">
                    ❌ Reject
                  </button>
                  <a href="${resource.url || '#'}" target="_blank" class="action-button view-button" style="text-decoration: none;">
                    📖 Read
                  </a>
                </div>
              </div>
            `).join('') : '<div class="empty-state"><h3>No new resources</h3><p>Resources are discovered daily from multiple sources</p></div>'}
          </div>
        </div>

        <!-- Approved Tab -->
        <div id="approved" class="tab-content">
          ${approved.length > 0 ? `
            <div class="items-grid">
              ${approved.map(item => `
                <div class="item-card" style="border: 2px solid #28a745; background: #f0fff4;">
                  <div class="item-header">
                    <a href="${item.website_url || item.github_url || '#'}" target="__blank" class="item-title">
                      ${item.name || 'Unnamed Project'}
                    </a>
                    <span class="badge-approved" style="background: #28a745; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px;">
                      ✅ APPROVED
                    </span>
                  </div>
                  
                  <p class="item-description">
                    ${item.description || 'No description available'}
                  </p>
                  
                  <div class="item-meta">
                    <span class="meta-item">📅 Approved: ${item.approved_at ? new Date(item.approved_at).toLocaleDateString() : 'Recently'}</span>
                    <span class="meta-item">⭐ Score: ${item.score || 0}</span>
                  </div>
                  
                  <div class="item-actions">
                    <a href="${item.website_url || item.github_url || '#'}" target="_blank" class="action-button view-button" style="text-decoration: none;">
                      🔗 View on Platform
                    </a>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : `
            <div class="empty-state">
              <h3>No approved items yet</h3>
              <p>Items you approve will appear here and on the Accelerate platform</p>
            </div>
          `}
        </div>
      </div>

      <script>
        function switchTab(tabName) {
          // Hide all tabs
          document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
          });
          document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active');
          });
          
          // Show selected tab
          document.getElementById(tabName).classList.add('active');
          event.target.classList.add('active');
        }

        async function approveItem(type, id) {
          if (confirm('Approve this ' + type + ' for the Accelerate platform? This will add it to the live platform.')) {
            try {
              // Actually update the database via POST request
              const response = await fetch('/', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  action: 'approve',
                  type: type,
                  id: id
                })
              });
              
              const result = await response.json();
              
              if (result.success) {
                // Visual feedback
                const card = event.target.closest('.item-card');
                card.style.background = '#d4edda';
                card.style.border = '2px solid #28a745';
                event.target.disabled = true;
                event.target.textContent = '✅ APPROVED';
                event.target.style.background = '#28a745';
                
                // Update counter
                const approvedTab = document.querySelector('.tab:nth-child(4)');
                const currentCount = parseInt(approvedTab.textContent.match(/\\d+/)[0]);
                approvedTab.textContent = 'Approved (' + (currentCount + 1) + ')';
                
                setTimeout(() => {
                  card.style.display = 'none';
                }, 2000);
              } else {
                alert('Failed to approve: ' + (result.error || 'Unknown error'));
              }
            } catch (error) {
              alert('Error approving item: ' + error.message);
            }
          }
        }

        async function rejectItem(type, id) {
          const reason = prompt('Why are you rejecting this ' + type + '? (optional)');
          if (reason !== null) { // User didn't cancel
            try {
              // Actually update the database via POST request
              const response = await fetch('/', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  action: 'reject',
                  type: type,
                  id: id,
                  reason: reason
                })
              });
              
              const result = await response.json();
              
              if (result.success) {
                // Visual feedback
                const card = event.target.closest('.item-card');
                card.style.background = '#f8d7da';
                card.style.border = '2px solid #dc3545';
                event.target.disabled = true;
                event.target.textContent = '❌ REJECTED';
                
                setTimeout(() => {
                  card.style.display = 'none';
                }, 1500);
              } else {
                alert('Failed to reject: ' + (result.error || 'Unknown error'));
              }
            } catch (error) {
              alert('Error rejecting item: ' + error.message);
            }
          }
        }
      </script>
    </body>
    </html>
  `;

  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(html);
}