
import type { Database } from '../types/supabase';
import * as cron from 'node-cron';
// Removed dotenv - uses environment variables directly
import { supabase } from '../lib/supabase-client';


// config(); - removed



interface PipelineConfig {
  schedule: string; // Cron expression
  contentTypes: Array<'projects' | 'funding' | 'resources'>;
  limit: number;
  autoPublish: boolean;
  minScore: number;
}

class AutomatedContentPipeline {
  private config: PipelineConfig;
  private isRunning: boolean = false;
  private task: cron.ScheduledTask | null = null;

  constructor(config: PipelineConfig) {
    this.config = config;
  }

  start() {
    if (this.isRunning) {
      console.log('Pipeline already running');
      return;
    }

    console.log(`🚀 Starting automated content pipeline with schedule: ${this.config.schedule}`);
    
    this.task = cron.schedule(this.config.schedule, async () => {
      await this.runPipeline();
    });

    this.isRunning = true;
    console.log('✅ Pipeline started successfully');
  }

  stop() {
    if (this.task) {
      this.task.stop();
      this.isRunning = false;
      console.log('🛑 Pipeline stopped');
    }
  }

  async runPipeline() {
    console.log(`\n📊 Running content pipeline at ${new Date().toISOString()}`);
    
    for (const contentType of this.config.contentTypes) {
      try {
        console.log(`\n🔄 Fetching ${contentType}...`);
        
        // Call the Edge Function to fetch and generate content
        const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
        
        const response = await fetch(`${supabaseUrl}/functions/v1/fetch-accelerate-content`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`
          },
          body: JSON.stringify({
            contentType,
            limit: this.config.limit
          })
        });

        const result = await response.json();

        if (result.success) {
          console.log(`✅ Generated ${result.content?.length || 0} content pieces for ${contentType}`);
          
          // Auto-publish high-scoring content if enabled
          if (this.config.autoPublish && result.content) {
            await this.autoPublishContent(result.content);
          }

          // Log statistics
          await this.logStatistics(contentType, result);
        } else {
          console.error(`❌ Failed to fetch ${contentType}:`, result.error);
        }
      } catch (error) {
        console.error(`❌ Error processing ${contentType}:`, error);
      }
    }

    console.log('\n✅ Pipeline run completed\n');
  }

  private async autoPublishContent(content: any[]) {
    for (const piece of content) {
      if (piece.score >= this.config.minScore) {
        // Update status to approved for high-scoring content
        const { error } = await supabase
          .from('content_queue')
          .update({ status: 'approved' } as any)
          .match({ 
            content: piece.content,
            platform: piece.platform 
          });

        if (!error) {
          console.log(`   📤 Auto-approved: ${piece.platform} content (score: ${piece.score})`);
        }
      }
    }
  }

  private async logStatistics(contentType: string, result: any) {
    const stats = {
      timestamp: new Date().toISOString(),
      content_type: contentType,
      items_fetched: result.sourceData?.length || result.data?.length || 0,
      content_generated: result.content?.length || 0,
      platforms: result.content?.map((c: any) => c.platform) || [],
      avg_score: result.content?.reduce((acc: number, c: any) => acc + (c.score || 0), 0) / (result.content?.length || 1)
    };

    // Store statistics in database
    await supabase
      // DISABLED: Table 'pipeline_stats' doesn't exist

      .from('pipeline_stats')
      .insert(stats as any) as any || { then: () => Promise.resolve({ data: null, error: null }) };

    console.log(`   📈 Stats: ${stats.items_fetched} items → ${stats.content_generated} content pieces`);
  }

  async runOnce() {
    console.log('🔄 Running pipeline once...');
    await this.runPipeline();
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      schedule: this.config.schedule,
      contentTypes: this.config.contentTypes,
      nextRun: this.task ? cron.getTasks().get(this.config.schedule) : null
    };
  }
}

// Export for use in other modules
export { AutomatedContentPipeline, PipelineConfig };

// CLI execution
if (require.main === module) {
  const pipeline = new AutomatedContentPipeline({
    schedule: process.env.PIPELINE_SCHEDULE || '0 */4 * * *', // Every 4 hours by default
    contentTypes: ['projects', 'funding', 'resources'],
    limit: 10,
    autoPublish: process.env.AUTO_PUBLISH === 'true',
    minScore: parseInt(process.env.MIN_SCORE || '80')
  });

  // Handle process signals
  process.on('SIGINT', () => {
    console.log('\n📊 Shutting down pipeline...');
    pipeline.stop();
    process.exit(0);
  });

  // Start based on command line argument
  const command = process.argv[2];
  
  switch (command) {
    case 'start':
      pipeline.start();
      console.log('Pipeline is running. Press Ctrl+C to stop.');
      break;
    
    case 'once':
      pipeline.runOnce().then(() => {
        console.log('✅ Single run completed');
        process.exit(0);
      });
      break;
    
    case 'status':
      console.log('Pipeline status:', pipeline.getStatus());
      process.exit(0);
      break;
    
    default:
      console.log(`
Automated Content Pipeline
Usage: tsx src/services/automated-pipeline.ts [command]

Commands:
  start   - Start the scheduled pipeline
  once    - Run the pipeline once and exit
  status  - Show pipeline status

Environment Variables:
  PIPELINE_SCHEDULE - Cron expression (default: "0 */4 * * *")
  AUTO_PUBLISH      - Auto-publish high-scoring content (default: false)
  MIN_SCORE         - Minimum score for auto-publishing (default: 80)
      `);
      process.exit(1);
  }
}