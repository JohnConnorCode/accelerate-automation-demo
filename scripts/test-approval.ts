#!/usr/bin/env tsx

import { supabase } from '../src/lib/supabase-client';

async function testApproval() {
  console.log('🧪 Testing Approval Workflow\n');
  
  // Get a project to approve
  const { data: projects } = await supabase
    .from('queue_projects')
    .select('*')
    .limit(1)
    .single();
    
  if (!projects) {
    console.log('No projects to approve');
    return;
  }
  
  console.log(`Found project: ${projects.company_name}`);
  console.log(`ID: ${projects.id}`);
  
  // Try to approve it via API
  const response = await fetch('http://localhost:3002/api/approve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: projects.id,
      type: 'projects',
      action: 'approve'
    })
  });
  
  const result = await response.json();
  console.log('\nApproval result:', result);
  
  // Check if it moved to live table
  if (result.success) {
    const { data: live } = await supabase
      .from('accelerate_projects')
      .select('*')
      .eq('company_name', projects.company_name)
      .single();
      
    if (live) {
      console.log('✅ Project successfully moved to live table!');
    } else {
      console.log('❌ Project not found in live table');
    }
  }
}

testApproval();
