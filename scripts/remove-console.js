#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Remove console statements from TypeScript files
function removeConsoleStatements() {
  const files = glob.sync('src/**/*.{ts,tsx}', {
    ignore: ['**/*.test.ts', '**/*.spec.ts', '**/node_modules/**']
  });

  let totalRemoved = 0;
  let filesModified = 0;

  files.forEach(file => {
    let content = fs.readFileSync(file, 'utf-8');
    const originalContent = content;
    
    // Remove simple console statements
    content = content.replace(/^\s*console\.(log|error|warn|info|debug|trace|dir|table|time|timeEnd|assert|count|group|groupEnd)\([^;]*\);?\s*$/gm, '');
    
    // Remove multi-line console statements
    content = content.replace(/^\s*console\.(log|error|warn|info|debug|trace|dir|table|time|timeEnd|assert|count|group|groupEnd)\([^)]*\n[^)]*\);?\s*$/gm, '');
    
    // Remove more complex multi-line console statements
    content = content.replace(/^\s*console\.(log|error|warn|info|debug|trace|dir|table|time|timeEnd|assert|count|group|groupEnd)\([^{]*\{[^}]*\}[^)]*\);?\s*$/gm, '');
    
    // Clean up extra blank lines
    content = content.replace(/\n\s*\n\s*\n/g, '\n\n');
    
    if (content !== originalContent) {
      fs.writeFileSync(file, content);
      filesModified++;
      
      // Count removed statements
      const removed = (originalContent.match(/console\./g) || []).length - 
                     (content.match(/console\./g) || []).length;
      totalRemoved += removed;
      console.log(`✓ ${path.relative(process.cwd(), file)}: Removed ${removed} console statements`);
    }
  });

  console.log(`\n📊 Summary:`);
  console.log(`   Files modified: ${filesModified}`);
  console.log(`   Console statements removed: ${totalRemoved}`);
}

removeConsoleStatements();