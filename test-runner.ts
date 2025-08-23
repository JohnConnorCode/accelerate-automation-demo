#!/usr/bin/env tsx
/**
 * Comprehensive Test Runner for Content Automation System
 * Tests all critical paths, integrations, and features
 */

import chalk from 'chalk'
import { supabase } from './src/lib/supabase'
import { contentServiceV2 } from './src/services/contentServiceV2'
import type { ContentItem } from './src/services/contentServiceV2'

interface TestResult {
  name: string
  category: string
  passed: boolean
  duration: number
  error?: string
  details?: any
}

class TestRunner {
  private results: TestResult[] = []
  private startTime = Date.now()

  async runTest(
    name: string,
    category: string,
    testFn: () => Promise<void>
  ): Promise<void> {
    const testStart = Date.now()
    const result: TestResult = {
      name,
      category,
      passed: false,
      duration: 0
    }

    try {
      await testFn()
      result.passed = true
      console.log(chalk.green(`✓ ${category}: ${name}`))
    } catch (error: any) {
      result.error = error.message
      console.log(chalk.red(`✗ ${category}: ${name}`))
      console.log(chalk.gray(`  Error: ${error.message}`))
    } finally {
      result.duration = Date.now() - testStart
      this.results.push(result)
    }
  }

  async runAllTests() {
    console.log(chalk.cyan('\n🧪 Running Comprehensive Test Suite\n'))
    
    // 1. Database Tests
    await this.runDatabaseTests()
    
    // 2. Service Tests
    await this.runServiceTests()
    
    // 3. API Tests
    await this.runAPITests()
    
    // 4. Integration Tests
    await this.runIntegrationTests()
    
    // 5. Security Tests
    await this.runSecurityTests()
    
    // Display results
    this.displayResults()
  }

  private async runDatabaseTests() {
    console.log(chalk.blue('\n📊 Database Tests\n'))

    await this.runTest('Supabase Connection', 'Database', async () => {
      const { data, error } = await supabase
        .from('content_queue')
        .select('count')
        .limit(1)
      
      if (error) throw error
    })

    await this.runTest('Content Queue Table', 'Database', async () => {
      const { data, error } = await supabase
        .from('content_queue')
        .select('*')
        .limit(1)
      
      if (error) throw error
    })

    await this.runTest('Categories Table', 'Database', async () => {
      const { data, error } = await supabase
        .from('content_categories')
        .select('*')
      
      if (error) throw error
    })

    await this.runTest('Write/Read Operations', 'Database', async () => {
      const timestamp = Date.now()
      const testItem = {
        title: `Test Item ${timestamp}`,
        description: 'This is a test item with a description that is longer than 50 characters',
        category: 'projects' as const,
        source: 'Test Runner',
        url: `https://example.com/test-${timestamp}`,
        type: 'projects',
        score: 75,
        status: 'pending_review' as const
      }

      // Insert
      const { data: inserted, error: insertError } = await supabase
        .from('content_queue')
        .insert(testItem)
        .select()
        .single()
      
      if (insertError) throw insertError

      // Read
      const { data: read, error: readError } = await supabase
        .from('content_queue')
        .select('*')
        .eq('id', inserted.id)
        .single()
      
      if (readError) throw readError
      if (!read) throw new Error('Failed to read inserted item')

      // Clean up
      await supabase.from('content_queue').delete().eq('id', inserted.id)
    })
  }

  private async runServiceTests() {
    console.log(chalk.blue('\n⚙️ Service Tests\n'))

    await this.runTest('Content Validation', 'Service', async () => {
      const validItem = {
        title: 'Valid Title',
        description: 'This is a valid description that is longer than 50 characters to pass validation',
        category: 'projects' as const,
        source: 'Test'
      }

      const validation = contentServiceV2.validateContent(validItem)
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`)
      }
    })

    await this.runTest('Invalid Content Detection', 'Service', async () => {
      const invalidItem = {
        title: '',
        description: 'Short',
        category: 'invalid' as any
      }

      const validation = contentServiceV2.validateContent(invalidItem)
      if (validation.isValid) {
        throw new Error('Should have detected invalid content')
      }
      
      if (validation.errors.length < 3) {
        throw new Error('Should have detected multiple errors')
      }
    })

    await this.runTest('Content Scoring', 'Service', async () => {
      const stats = await contentServiceV2.getStats()
      if (typeof stats.avgScore !== 'number') {
        throw new Error('Stats should include average score')
      }
    })

    await this.runTest('Queue Management', 'Service', async () => {
      const testItem = {
        title: 'Queue Test Item',
        description: 'Testing queue management functionality with a proper description over 50 chars',
        category: 'resources' as const,
        source: 'Test Runner',
        url: `https://example.com/test-${Date.now()}`
      }

      const result = await contentServiceV2.addToQueue(testItem)
      if (!result.success) {
        throw new Error('Failed to add item to queue')
      }

      // Clean up
      if (result.id) {
        await supabase.from('content_queue').delete().eq('id', result.id)
      }
    })
  }

  private async runAPITests() {
    console.log(chalk.blue('\n🌐 API Tests\n'))

    await this.runTest('Health Check', 'API', async () => {
      const response = await fetch('http://localhost:3000/api/health')
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      
      const data = await response.json()
      if (data.status !== 'healthy') {
        throw new Error('API is not healthy')
      }
    })

    await this.runTest('Dashboard Stats', 'API', async () => {
      const response = await fetch('http://localhost:3000/api/dashboard')
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      
      const data = await response.json()
      if (!data.stats) {
        throw new Error('Dashboard should return stats')
      }
    })

    await this.runTest('Analytics Endpoint', 'API', async () => {
      const response = await fetch('http://localhost:3000/api/analytics')
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      
      const data = await response.json()
      if (typeof data.totalItems !== 'number') {
        throw new Error('Analytics should return totalItems')
      }
    })

    await this.runTest('Search Functionality', 'API', async () => {
      const response = await fetch('http://localhost:3000/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'test' })
      })
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      
      const data = await response.json()
      if (!Array.isArray(data.results)) {
        throw new Error('Search should return results array')
      }
    })
  }

  private async runIntegrationTests() {
    console.log(chalk.blue('\n🔄 Integration Tests\n'))

    await this.runTest('End-to-End Content Flow', 'Integration', async () => {
      // 1. Create content
      const testContent = {
        title: `Integration Test ${Date.now()}`,
        description: 'Complete end-to-end test of content flow from creation to approval with proper validation',
        category: 'projects' as const,
        source: 'Integration Test',
        url: 'https://example.com/integration-test'
      }

      // 2. Add to queue via API
      const queueResponse = await fetch('http://localhost:3000/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'queue',
          items: [testContent]
        })
      })

      if (!queueResponse.ok) {
        throw new Error('Failed to queue content')
      }

      const queueResult = await queueResponse.json()
      if (!queueResult.success) {
        throw new Error('Queue operation failed')
      }

      // 3. Get dashboard to verify
      const dashResponse = await fetch('http://localhost:3000/api/dashboard')
      const dashData = await dashResponse.json()
      
      if (!dashData.items || dashData.items.length === 0) {
        throw new Error('Content not found in dashboard')
      }

      // 4. Clean up
      const itemId = dashData.items.find((i: any) => i.title === testContent.title)?.id
      if (itemId) {
        await supabase.from('content_queue').delete().eq('id', itemId)
      }
    })

    await this.runTest('Content Enrichment Pipeline', 'Integration', async () => {
      // Test the enrichment flow (without actual GPT calls)
      const { data: items } = await supabase
        .from('content_queue')
        .select('*')
        .limit(1)
      
      if (items && items.length > 0) {
        const response = await fetch('http://localhost:3000/api/enrich', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: items[0].id,
            options: { aiAnalysis: false, keywords: true }
          })
        })

        if (!response.ok) {
          throw new Error('Enrichment endpoint failed')
        }
      }
    })
  }

  private async runSecurityTests() {
    console.log(chalk.blue('\n🔒 Security Tests\n'))

    await this.runTest('XSS Prevention', 'Security', async () => {
      const maliciousContent = {
        title: '<script>alert("XSS")</script>Test',
        description: 'Test description with <img src=x onerror=alert("XSS")> malicious content that should be sanitized',
        category: 'projects' as const,
        source: 'Security Test'
      }

      const validation = contentServiceV2.validateContent(maliciousContent)
      // The service should sanitize but still validate
      if (!validation.isValid && validation.errors.some(e => e.includes('script'))) {
        throw new Error('Should sanitize rather than reject XSS attempts')
      }
    })

    await this.runTest('Input Validation', 'Security', async () => {
      const invalidInputs = [
        { title: '', description: '', category: '' },
        { title: 'a'.repeat(1000), description: 'test', category: 'projects' },
        { title: 'test', description: 'short', category: 'invalid' }
      ]

      for (const input of invalidInputs) {
        const validation = contentServiceV2.validateContent(input as any)
        if (validation.isValid) {
          throw new Error(`Should have rejected invalid input: ${JSON.stringify(input)}`)
        }
      }
    })

    await this.runTest('SQL Injection Prevention', 'Security', async () => {
      const sqlInjection = "'; DROP TABLE content_queue; --"
      
      const response = await fetch('http://localhost:3000/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: sqlInjection })
      })

      // Should handle the query safely
      if (!response.ok && response.status === 500) {
        throw new Error('SQL injection may not be properly handled')
      }

      // Verify table still exists
      const { error } = await supabase.from('content_queue').select('count').limit(1)
      if (error) {
        throw new Error('Table may have been affected by SQL injection')
      }
    })
  }

  private displayResults() {
    console.log(chalk.cyan('\n📈 Test Results\n'))
    
    const passed = this.results.filter(r => r.passed).length
    const failed = this.results.filter(r => !r.passed).length
    const total = this.results.length
    const duration = Date.now() - this.startTime

    // Group by category
    const byCategory = this.results.reduce((acc, r) => {
      if (!acc[r.category]) {
        acc[r.category] = { passed: 0, failed: 0 }
      }
      if (r.passed) {
        acc[r.category].passed++
      } else {
        acc[r.category].failed++
      }
      return acc
    }, {} as Record<string, { passed: number; failed: number }>)

    console.log(chalk.white('Category Breakdown:'))
    Object.entries(byCategory).forEach(([category, stats]) => {
      const icon = stats.failed === 0 ? '✅' : '⚠️'
      console.log(`  ${icon} ${category}: ${stats.passed}/${stats.passed + stats.failed} passed`)
    })

    console.log('')
    
    if (failed === 0) {
      console.log(chalk.green.bold(`✨ All ${total} tests passed! (${duration}ms)`))
    } else {
      console.log(chalk.yellow(`⚠️ ${passed}/${total} tests passed (${failed} failed) in ${duration}ms`))
      
      console.log(chalk.red('\nFailed Tests:'))
      this.results.filter(r => !r.passed).forEach(r => {
        console.log(chalk.red(`  • ${r.category}: ${r.name}`))
        if (r.error) {
          console.log(chalk.gray(`    ${r.error}`))
        }
      })
    }

    // Performance metrics
    console.log(chalk.cyan('\n⚡ Performance Metrics:'))
    const avgDuration = this.results.reduce((sum, r) => sum + r.duration, 0) / total
    const slowest = this.results.sort((a, b) => b.duration - a.duration)[0]
    console.log(`  Average test duration: ${avgDuration.toFixed(2)}ms`)
    console.log(`  Slowest test: ${slowest.name} (${slowest.duration}ms)`)
    
    // Exit code
    process.exit(failed > 0 ? 1 : 0)
  }
}

// Run tests
async function main() {
  const runner = new TestRunner()
  
  try {
    await runner.runAllTests()
  } catch (error: any) {
    console.error(chalk.red('\n❌ Test runner failed:'), error.message)
    process.exit(1)
  }
}

main().catch(console.error)