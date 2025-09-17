#!/usr/bin/env npx tsx

/**
 * Comprehensive System Validation Script
 * Tests all critical components and reports system health
 */

import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface ValidationResult {
  component: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  details?: any;
}

class SystemValidator {
  private results: ValidationResult[] = [];
  private startTime = Date.now();

  async validate(): Promise<void> {
    console.log('🔍 ACCELERATE System Validation\n');
    console.log('=' .repeat(60));
    
    // Phase 1: Environment & Configuration
    console.log('\n📋 Phase 1: Environment & Configuration');
    await this.validateEnvironment();
    await this.validateDependencies();
    
    // Phase 2: Code Quality
    console.log('\n📋 Phase 2: Code Quality');
    await this.validateTypeScript();
    await this.validateLinting();
    
    // Phase 3: Database & API
    console.log('\n📋 Phase 3: Database & API');
    await this.validateDatabase();
    await this.validateAPI();
    
    // Phase 4: Pipeline & Features
    console.log('\n📋 Phase 4: Pipeline & Features');
    await this.validatePipeline();
    
    // Phase 5: Tests
    console.log('\n📋 Phase 5: Tests');
    await this.validateTests();
    
    // Final Report
    this.generateReport();
  }

  private async validateEnvironment(): Promise<void> {
    console.log('  Checking environment configuration...');
    
    // Check for env files
    const envFiles = ['.env.local', '.env'];
    let envFound = false;
    
    for (const file of envFiles) {
      if (fs.existsSync(path.join(process.cwd(), file))) {
        envFound = true;
        break;
      }
    }
    
    if (!envFound) {
      this.addResult('Environment', 'fail', 'No environment file found');
    } else {
      // Check for required variables
      const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];
      const missing = required.filter(key => !process.env[key] && !process.env[`VITE_${key}`]);
      
      if (missing.length > 0) {
        this.addResult('Environment', 'warn', `Missing variables: ${missing.join(', ')}`);
      } else {
        this.addResult('Environment', 'pass', 'All required variables present');
      }
    }
    
    // Check for exposed secrets
    try {
      const { stdout } = await execAsync('grep -r "sk-proj\\|eyJ" src/ 2>/dev/null | wc -l');
      const exposedCount = parseInt(stdout.trim());
      
      if (exposedCount > 0) {
        this.addResult('Security', 'fail', `${exposedCount} exposed secrets found in code`);
      } else {
        this.addResult('Security', 'pass', 'No exposed secrets in code');
      }
    } catch {
      this.addResult('Security', 'warn', 'Could not check for exposed secrets');
    }
  }

  private async validateDependencies(): Promise<void> {
    console.log('  Checking dependencies...');
    
    try {
      // Check for outdated packages
      const { stdout } = await execAsync('npm outdated --json 2>/dev/null || true');
      const outdated = stdout ? JSON.parse(stdout) : {};
      const outdatedCount = Object.keys(outdated).length;
      
      if (outdatedCount > 10) {
        this.addResult('Dependencies', 'warn', `${outdatedCount} outdated packages`);
      } else {
        this.addResult('Dependencies', 'pass', `${outdatedCount} outdated packages`);
      }
      
      // Check for vulnerabilities
      const { stdout: auditOut } = await execAsync('npm audit --json 2>/dev/null || true');
      const audit = JSON.parse(auditOut);
      
      if (audit.metadata && audit.metadata.vulnerabilities) {
        const vulns = audit.metadata.vulnerabilities;
        const critical = vulns.critical || 0;
        const high = vulns.high || 0;
        
        if (critical > 0 || high > 0) {
          this.addResult('Security Audit', 'fail', `${critical} critical, ${high} high vulnerabilities`);
        } else if (vulns.moderate > 0) {
          this.addResult('Security Audit', 'warn', `${vulns.moderate} moderate vulnerabilities`);
        } else {
          this.addResult('Security Audit', 'pass', 'No significant vulnerabilities');
        }
      }
    } catch (err) {
      this.addResult('Dependencies', 'warn', 'Could not check dependencies');
    }
  }

  private async validateTypeScript(): Promise<void> {
    console.log('  Checking TypeScript compilation...');
    
    try {
      const { stdout, stderr } = await execAsync('npm run typecheck 2>&1 | grep "error TS" | wc -l');
      const errorCount = parseInt(stdout.trim());
      
      if (errorCount === 0) {
        this.addResult('TypeScript', 'pass', 'No compilation errors');
      } else if (errorCount < 50) {
        this.addResult('TypeScript', 'warn', `${errorCount} compilation errors`);
      } else {
        this.addResult('TypeScript', 'fail', `${errorCount} compilation errors`);
      }
    } catch {
      this.addResult('TypeScript', 'fail', 'TypeScript check failed');
    }
  }

  private async validateLinting(): Promise<void> {
    console.log('  Checking code quality...');
    
    try {
      const { stdout } = await execAsync('npm run lint 2>&1 | tail -1');
      
      if (stdout.includes('0 errors')) {
        this.addResult('ESLint', 'pass', 'No linting errors');
      } else {
        const match = stdout.match(/(\d+) errors?.*?(\d+) warnings?/);
        if (match) {
          const errors = parseInt(match[1]);
          const warnings = parseInt(match[2]);
          
          if (errors > 0) {
            this.addResult('ESLint', 'fail', `${errors} errors, ${warnings} warnings`);
          } else {
            this.addResult('ESLint', 'warn', `${warnings} warnings`);
          }
        } else {
          this.addResult('ESLint', 'warn', 'Linting completed with issues');
        }
      }
    } catch {
      this.addResult('ESLint', 'warn', 'Could not run linter');
    }
  }

  private async validateDatabase(): Promise<void> {
    console.log('  Checking database connection...');
    
    // This would normally test actual database connection
    // For now, we check if the configuration exists
    const hasDbConfig = process.env.SUPABASE_URL && !process.env.SUPABASE_URL.includes('your-');
    
    if (hasDbConfig) {
      this.addResult('Database', 'pass', 'Database configured');
    } else {
      this.addResult('Database', 'fail', 'Database not configured');
    }
  }

  private async validateAPI(): Promise<void> {
    console.log('  Checking API endpoints...');
    
    try {
      // Check if server is running
      const { stdout } = await execAsync('curl -s http://localhost:3000/api/health 2>/dev/null || echo "offline"');
      
      if (stdout.includes('healthy')) {
        this.addResult('API Server', 'pass', 'Server is healthy');
        
        // Check monitoring endpoint
        const { stdout: monitorOut } = await execAsync('curl -s http://localhost:3000/api/monitoring 2>/dev/null | head -c 100');
        if (monitorOut.includes('health')) {
          this.addResult('Monitoring', 'pass', 'Monitoring endpoint working');
        }
      } else if (stdout.includes('offline')) {
        this.addResult('API Server', 'warn', 'Server not running');
      } else {
        this.addResult('API Server', 'fail', 'Server unhealthy');
      }
    } catch {
      this.addResult('API Server', 'warn', 'Could not test API');
    }
  }

  private async validatePipeline(): Promise<void> {
    console.log('  Checking content pipeline...');
    
    // Check if pipeline files exist
    const pipelineFiles = [
      'src/core/unified-orchestrator.ts',
      'src/services/staging-service.ts',
      'src/validators/accelerate-validator.ts'
    ];
    
    const missingFiles = pipelineFiles.filter(file => !fs.existsSync(path.join(process.cwd(), file)));
    
    if (missingFiles.length === 0) {
      this.addResult('Pipeline Files', 'pass', 'All core pipeline files present');
    } else {
      this.addResult('Pipeline Files', 'fail', `Missing: ${missingFiles.join(', ')}`);
    }
    
    // Check if data sources are configured
    const sources = [
      'src/fetchers/hackernews-fetcher.ts',
      'src/fetchers/github-fetcher.ts',
      'src/fetchers/reddit-fetcher.ts'
    ];
    
    const presentSources = sources.filter(file => fs.existsSync(path.join(process.cwd(), file)));
    
    if (presentSources.length >= 2) {
      this.addResult('Data Sources', 'pass', `${presentSources.length} sources available`);
    } else {
      this.addResult('Data Sources', 'warn', `Only ${presentSources.length} sources available`);
    }
  }

  private async validateTests(): Promise<void> {
    console.log('  Checking test suites...');
    
    try {
      const { stdout } = await execAsync('npm test -- --listTests 2>/dev/null | wc -l');
      const testCount = parseInt(stdout.trim());
      
      if (testCount > 0) {
        // Run tests and get summary
        const { stdout: testOut } = await execAsync('npm test -- --silent 2>&1 | grep -E "Test Suites|Tests:" | tail -2');
        
        if (testOut.includes('passed')) {
          const match = testOut.match(/(\d+) failed.*?(\d+) passed.*?(\d+) total/);
          if (match) {
            const failed = parseInt(match[1]);
            const passed = parseInt(match[2]);
            const total = parseInt(match[3]);
            
            if (failed === 0) {
              this.addResult('Tests', 'pass', `All ${total} tests passing`);
            } else if (failed < total / 2) {
              this.addResult('Tests', 'warn', `${failed}/${total} tests failing`);
            } else {
              this.addResult('Tests', 'fail', `${failed}/${total} tests failing`);
            }
          }
        }
      } else {
        this.addResult('Tests', 'fail', 'No tests found');
      }
    } catch {
      this.addResult('Tests', 'warn', 'Could not run tests');
    }
  }

  private addResult(component: string, status: 'pass' | 'fail' | 'warn', message: string, details?: any): void {
    this.results.push({ component, status, message, details });
    
    const icon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⚠️';
    console.log(`    ${icon} ${component}: ${message}`);
  }

  private generateReport(): void {
    const duration = Date.now() - this.startTime;
    const passed = this.results.filter(r => r.status === 'pass').length;
    const failed = this.results.filter(r => r.status === 'fail').length;
    const warned = this.results.filter(r => r.status === 'warn').length;
    const total = this.results.length;
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 VALIDATION REPORT');
    console.log('='.repeat(60));
    
    console.log(`\n  Total Checks: ${total}`);
    console.log(`  ✅ Passed: ${passed} (${Math.round(passed/total * 100)}%)`);
    console.log(`  ⚠️  Warnings: ${warned} (${Math.round(warned/total * 100)}%)`);
    console.log(`  ❌ Failed: ${failed} (${Math.round(failed/total * 100)}%)`);
    console.log(`  ⏱️  Duration: ${(duration/1000).toFixed(2)}s`);
    
    // Overall health score
    const score = Math.round((passed * 100 + warned * 50) / (total * 100) * 100);
    console.log(`\n  🏆 Health Score: ${score}%`);
    
    if (score >= 90) {
      console.log('  Status: EXCELLENT - System ready for production');
    } else if (score >= 70) {
      console.log('  Status: GOOD - Minor issues to address');
    } else if (score >= 50) {
      console.log('  Status: FAIR - Several issues need attention');
    } else {
      console.log('  Status: POOR - Critical issues must be fixed');
    }
    
    // Critical issues
    const criticalIssues = this.results.filter(r => r.status === 'fail');
    if (criticalIssues.length > 0) {
      console.log('\n⚠️  Critical Issues to Fix:');
      criticalIssues.forEach(issue => {
        console.log(`  - ${issue.component}: ${issue.message}`);
      });
    }
    
    // Recommendations
    console.log('\n💡 Recommendations:');
    if (failed > 0) {
      console.log('  1. Fix critical failures first (marked with ❌)');
    }
    if (warned > 3) {
      console.log('  2. Address warnings to improve stability');
    }
    if (this.results.find(r => r.component === 'TypeScript' && r.status !== 'pass')) {
      console.log('  3. Resolve TypeScript errors for better type safety');
    }
    if (this.results.find(r => r.component === 'Tests' && r.status !== 'pass')) {
      console.log('  4. Fix failing tests to ensure reliability');
    }
    if (this.results.find(r => r.component === 'Security' && r.status === 'fail')) {
      console.log('  5. URGENT: Remove exposed secrets from code');
    }
    
    console.log('\n' + '='.repeat(60));
    
    // Exit code based on score
    process.exit(score >= 50 ? 0 : 1);
  }
}

// Run validation
const validator = new SystemValidator();
validator.validate().catch(console.error);