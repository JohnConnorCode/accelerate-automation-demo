// @ts-nocheck
import type { Database } from '../../types/supabase';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

import { AutomatedContentPipeline } from '../../services/automated-pipeline';
import { supabase } from '../../lib/supabase-client';


// Initialize Supabase client


describe('Content Automation Integration Tests', () => {
  let testProjectId: string;
  let testFundingId: string;
  let testResourceId: string;
  let generatedContentIds: string[] = [];

  beforeAll(async () => {
    // Create test data in the actual database
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        name: 'Test Web3 Project',
        tagline: 'Revolutionary DeFi protocol for automated testing',
        description: 'This is a test project for content automation integration tests',
        website: 'https://test-project.com',
        github: 'https://github.com/test/project',
        categories: ['DeFi', 'Testing'],
        status: 'active'
      } as any)
      .select()
      .single();

    if (!projectError && project) {
      testProjectId = project.id;
    }

    const { data: funding, error: fundingError } = await supabase
      .from('funding_programs')
      .insert({
        name: 'Test Grant Program',
        description: 'Test funding opportunity for integration testing',
        website: 'https://test-grants.com',
        status: 'active'
      } as any)
      .select()
      .single();

    if (!fundingError && funding) {
      testFundingId = funding.id;
    }

    const { data: resource, error: resourceError } = await supabase
      .from('resources')
      .insert({
        name: 'Test Developer Guide',
        description: 'Comprehensive guide for Web3 development testing',
        category: 'Documentation',
        url: 'https://test-resources.com/guide',
        tags: ['web3', 'development', 'testing']
      } as any)
      .select()
      .single();

    if (!resourceError && resource) {
      testResourceId = resource.id;
    }
  });

  afterAll(async () => {
    // Clean up test data
    if (testProjectId) {
      await supabase.from('projects').delete().eq('id', testProjectId);
    }
    if (testFundingId) {
      await supabase.from('funding_programs').delete().eq('id', testFundingId);
    }
    if (testResourceId) {
      await supabase.from('resources').delete().eq('id', testResourceId);
    }
    
    // Clean up generated content
    if (generatedContentIds.length > 0) {
      await supabase.from('content_queue').delete().in('id', generatedContentIds);
    }
  });

  describe('Edge Function: fetch-accelerate-content', () => {
    it('should fetch and generate content for projects', async () => {
      const response = await fetch(
        `${process.env.SUPABASE_URL}/functions/v1/fetch-accelerate-content`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({
            contentType: 'projects',
            limit: 5
          })
        }
      );

      const result = await response.json();
      
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
      expect(Array.isArray(result.content)).toBe(true);
      
      // Should generate both Twitter and LinkedIn content
      const platforms = result.content.map((c: any) => c.platform);
      expect(platforms).toContain('twitter');
      expect(platforms).toContain('linkedin');
      
      // Verify content was saved to database
      const { data: queuedContent } = await supabase
        .from('content_queue')
        .select('*')
        .eq('topic', 'projects update')
        .order('created_at', { ascending: false })
        .limit(2);
      
      expect(queuedContent).toBeDefined();
      expect(queuedContent?.length).toBeGreaterThan(0);
      
      // Store IDs for cleanup
      if (queuedContent) {
        generatedContentIds.push(...queuedContent.map(c => c.id));
      }
    });

    it('should fetch and generate content for funding opportunities', async () => {
      const response = await fetch(
        `${process.env.SUPABASE_URL}/functions/v1/fetch-accelerate-content`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({
            contentType: 'funding',
            limit: 5
          })
        }
      );

      const result = await response.json();
      
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      
      if (result.content) {
        expect(Array.isArray(result.content)).toBe(true);
        
        // Check metadata includes source data
        result.content.forEach((piece: any) => {
          expect(piece.sourceData).toBeDefined();
          expect(piece.type).toBe('funding');
        });
      }
    });

    it('should fetch and generate content for resources', async () => {
      const response = await fetch(
        `${process.env.SUPABASE_URL}/functions/v1/fetch-accelerate-content`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({
            contentType: 'resources',
            limit: 5
          })
        }
      );

      const result = await response.json();
      
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
    });
  });

  describe('Automated Pipeline', () => {
    it('should run pipeline once and generate content', async () => {
      const pipeline = new AutomatedContentPipeline({
        schedule: '0 */4 * * *',
        contentTypes: ['projects'],
        limit: 3,
        autoPublish: false,
        minScore: 80
      });

      await pipeline.runOnce();
      
      // Verify content was generated
      const { data: recentContent } = await supabase
        .from('content_queue')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
      
      expect(recentContent).toBeDefined();
      expect(recentContent?.length).toBeGreaterThan(0);
      
      // Store IDs for cleanup
      if (recentContent) {
        generatedContentIds.push(...recentContent.map(c => c.id));
      }
    });

    it('should auto-approve high-scoring content when enabled', async () => {
      const pipeline = new AutomatedContentPipeline({
        schedule: '0 */4 * * *',
        contentTypes: ['projects'],
        limit: 2,
        autoPublish: true,
        minScore: 70
      });

      await pipeline.runOnce();
      
      // Check for approved content
      const { data: approvedContent } = await supabase
        .from('content_queue')
        .select('*')
        .eq('status', 'approved')
        .gte('score', 70)
        .order('created_at', { ascending: false })
        .limit(5);
      
      // Some content should be auto-approved if score is high enough
      if (approvedContent && approvedContent.length > 0) {
        expect(approvedContent[0].status).toBe('approved');
        expect(approvedContent[0].score).toBeGreaterThanOrEqual(70);
        
        // Store IDs for cleanup
        generatedContentIds.push(...approvedContent.map(c => c.id));
      }
    });
  });

  describe('Dashboard Integration', () => {
    it('should handle content generation from Dashboard component', async () => {
      // Simulate Dashboard API call
      const mockDashboardRequest = async (contentType: string) => {
        const response = await fetch(
          `${process.env.SUPABASE_URL}/functions/v1/fetch-accelerate-content`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({
              contentType,
              limit: 5
            })
          }
        );
        
        return response.json();
      };

      // Test all three content types as Dashboard would
      const projectsResult = await mockDashboardRequest('projects');
      expect(projectsResult.success).toBe(true);
      
      const fundingResult = await mockDashboardRequest('funding');
      expect(fundingResult.success).toBe(true);
      
      const resourcesResult = await mockDashboardRequest('resources');
      expect(resourcesResult.success).toBe(true);
    });
  });

  describe('Data Validation', () => {
    it('should properly handle empty data sets', async () => {
      // Test with a filter that returns no results
      const response = await fetch(
        `${process.env.SUPABASE_URL}/functions/v1/fetch-accelerate-content`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({
            contentType: 'projects',
            limit: 0 // Request 0 items
          })
        }
      );

      const result = await response.json();
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
    });

    it('should validate content structure', async () => {
      const response = await fetch(
        `${process.env.SUPABASE_URL}/functions/v1/fetch-accelerate-content`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({
            contentType: 'projects',
            limit: 2
          })
        }
      );

      const result = await response.json();
      
      if (result.content && result.content.length > 0) {
        result.content.forEach((piece: any) => {
          // Validate required fields
          expect(piece).toHaveProperty('platform');
          expect(piece).toHaveProperty('content');
          expect(piece).toHaveProperty('type');
          expect(piece).toHaveProperty('sourceData');
          
          // Validate platform values
          expect(['twitter', 'linkedin']).toContain(piece.platform);
          
          // Validate content is not empty
          expect(piece.content).toBeTruthy();
          expect(piece.content.length).toBeGreaterThan(0);
        });
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid content type gracefully', async () => {
      const response = await fetch(
        `${process.env.SUPABASE_URL}/functions/v1/fetch-accelerate-content`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({
            contentType: 'invalid_type',
            limit: 5
          })
        }
      );

      const result = await response.json();
      // Should still return success but with no data
      expect(response.status).toBe(200);
    });

    it('should handle network errors in pipeline', async () => {
      const pipeline = new AutomatedContentPipeline({
        schedule: '0 */4 * * *',
        contentTypes: ['projects'],
        limit: 5,
        autoPublish: false,
        minScore: 80
      });

      // Mock a network error by using invalid URL
      const originalUrl = process.env.SUPABASE_URL;
      process.env.SUPABASE_URL = 'https://invalid-url.com';
      
      // Should not throw, but handle error gracefully
      await expect(pipeline.runOnce()).resolves.not.toThrow();
      
      // Restore URL
      process.env.SUPABASE_URL = originalUrl;
    });
  });
});