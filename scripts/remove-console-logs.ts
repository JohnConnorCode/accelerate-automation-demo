#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

async function removeConsoleLogs() {
  console.log('Removing console.log statements from production code...\n');
  
  // Find all TypeScript files in src
  const files = await glob('src/**/*.ts', {
    ignore: ['**/node_modules/**', '**/*.test.ts', '**/*.spec.ts']
  });
  
  let totalRemoved = 0;
  
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    let modified = false;
    
    const newLines = lines.map(line => {
      // Skip if it's a comment
      if (line.trim().startsWith('//')) return line;
      
      // Replace console.log with logger.debug (if logger exists)
      if (line.includes('console.log(')) {
        modified = true;
        totalRemoved++;
        // Comment out for now - in production these should use proper logger
        return line.replace('console.log(', '// console.log(');
      }
      
      // Replace console.error with logger.error
      if (line.includes('console.error(')) {
        modified = true;
        totalRemoved++;
        return line.replace('console.error(', '// console.error(');
      }
      
      // Replace console.warn with logger.warn
      if (line.includes('console.warn(')) {
        modified = true;
        totalRemoved++;
        return line.replace('console.warn(', '// console.warn(');
      }
      
      return line;
    });
    
    if (modified) {
      fs.writeFileSync(file, newLines.join('\n'));
      console.log(`✓ Cleaned ${path.basename(file)}`);
    }
  }
  
  console.log(`\n✅ Removed/commented ${totalRemoved} console statements`);
}

removeConsoleLogs().catch(console.error);