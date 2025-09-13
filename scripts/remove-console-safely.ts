#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

/**
 * Safely remove console statements from TypeScript files
 * Preserves code structure and handles multi-line statements
 */

async function removeConsoleLogs() {
  const files = await glob('src/**/*.{ts,tsx}', {
    ignore: ['**/*.test.ts', '**/*.spec.ts', '**/node_modules/**']
  });

  let totalRemoved = 0;
  let filesModified = 0;

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    const modifiedLines: string[] = [];
    let inConsoleStatement = false;
    let bracketDepth = 0;
    let removedInFile = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check if this line starts a console statement
      if (!inConsoleStatement && /^\s*console\.(log|error|warn|info|debug|trace|dir|table|time|timeEnd|assert|count|group|groupEnd)\s*\(/.test(line)) {
        inConsoleStatement = true;
        bracketDepth = 0;
        
        // Count brackets in this line
        for (const char of line) {
          if (char === '(') {bracketDepth++;}
          if (char === ')') {bracketDepth--;}
        }
        
        // If brackets are balanced, we're done with this console statement
        if (bracketDepth === 0) {
          inConsoleStatement = false;
          removedInFile++;
          totalRemoved++;
          // Comment out the line instead of removing it
          modifiedLines.push('    // ' + line.trim());
        } else {
          // Start of multi-line console statement
          modifiedLines.push('    // ' + line.trim());
        }
      } else if (inConsoleStatement) {
        // We're in a multi-line console statement
        for (const char of line) {
          if (char === '(') {bracketDepth++;}
          if (char === ')') {bracketDepth--;}
        }
        
        // Comment out this line too
        modifiedLines.push('    // ' + line.trim());
        
        // Check if we've closed all brackets
        if (bracketDepth === 0) {
          inConsoleStatement = false;
          removedInFile++;
          totalRemoved++;
        }
      } else {
        // Regular line, keep as-is
        modifiedLines.push(line);
      }
    }

    // Only write if we made changes
    if (removedInFile > 0) {
      fs.writeFileSync(file, modifiedLines.join('\n'));
      filesModified++;
      console.log(`✓ ${path.relative(process.cwd(), file)}: Removed ${removedInFile} console statements`);
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Files modified: ${filesModified}`);
  console.log(`   Console statements removed: ${totalRemoved}`);
}

// Run the script
removeConsoleLogs().catch(console.error);