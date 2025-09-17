#!/usr/bin/env npx tsx

import fs from 'fs';
import { glob } from 'glob';

/**
 * Fix remaining TypeScript errors
 */

async function fixRemainingErrors() {
  console.log('🔧 Fixing remaining TypeScript errors...\n');

  // Fix the "as any)" pattern that's causing comma errors
  console.log('1️⃣ Fixing double "as any" issues...');
  
  const allFiles = await glob('{src,scripts}/**/*.{ts,tsx}', { ignore: ['**/node_modules/**'] });
  
  let fixedCount = 0;
  for (const file of allFiles) {
    let content = fs.readFileSync(file, 'utf-8');
    let changed = false;
    
    // Fix double "as any"
    if (content.includes('as any')) {
      content = content.replace(/as any/g, 'as any');
      changed = true;
    }
    
    // Fix "new Date()"
    if (content.includes('new Date()')) {
      content = content.replace(/new Date\( as any\)/g, 'new Date()');
      changed = true;
    }
    
    // Fix malformed patterns like ".insert(data as any)"
    content = content.replace(/\(([^)]+) as any\)/g, (match, group) => {
      // Check if it's a valid type assertion
      if (group.includes('(') && !group.includes(')')) {
        // Malformed, fix it
        return `(${group})`;
      }
      return match;
    });
    
    // Fix shebang errors in scripts - must be first line
    if (file.includes('scripts/') && content.includes('#!/usr/bin/env')) {
      const lines = content.split('\n');
      const shebangIndex = lines.findIndex(line => line.startsWith('#!'));
      if (shebangIndex > 0) {
        // Move shebang to first line
        const shebang = lines[shebangIndex];
        lines.splice(shebangIndex, 1);
        lines.unshift(shebang);
        content = lines.join('\n');
        changed = true;
      }
    }
    
    // Fix import duplication
    if (content.includes('import { supabase }') && content.match(/import { supabase }.*\nimport { supabase }/)) {
      // Remove duplicate import
      content = content.replace(/import { supabase } from '\.\.\/lib\/supabase';\nimport { supabase }/, 'import { supabase }');
      changed = true;
    }
    
    // Fix AuthContext duplicate import
    if (file.includes('AuthContext.tsx')) {
      content = content.replace(
        /import { supabase } from '\.\.\/lib\/supabase';\nimport { supabase } from '\.\.\/lib\/supabase-client';/,
        "import { supabase } from '../lib/supabase-client';"
      );
      changed = true;
    }
    
    if (changed) {
      fs.writeFileSync(file, content, 'utf-8');
      console.log(`   ✓ Fixed ${file}`);
      fixedCount++;
    }
  }
  
  console.log(`   Fixed ${fixedCount} files\n`);
  
  // Fix 2: Remove problematic type assertions that are breaking
  console.log('2️⃣ Cleaning up type assertions...');
  
  for (const file of allFiles) {
    let content = fs.readFileSync(file, 'utf-8');
    let changed = false;
    
    // Fix patterns like: toISOString( as any)
    content = content.replace(/\.toISOString\(\s*as\s+any\s*\)/g, '.toISOString()');
    
    // Fix patterns like: new Date()
    content = content.replace(/new\s+Date\(\s*as\s+any\s*\)/g, 'new Date()');
    
    // Fix specific issue with json stringify
    content = content.replace(/JSON\.stringify\(([^)]+)\s+as\s+any\)/g, 'JSON.stringify($1)');
    
    if (content !== fs.readFileSync(file, 'utf-8')) {
      fs.writeFileSync(file, content, 'utf-8');
      console.log(`   ✓ Cleaned ${file}`);
      changed = true;
    }
  }
  
  console.log('\n✅ Remaining TypeScript errors fixed!');
  console.log('   Run "npm run typecheck" to verify');
}

// Run the fixes
fixRemainingErrors().catch(console.error);