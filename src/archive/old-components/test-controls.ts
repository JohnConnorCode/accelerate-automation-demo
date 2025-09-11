import { Request, Response } from 'express';
import { orchestrator } from '../core/simple-orchestrator';

export async function testManualControls(req: Request, res: Response) {
  try {
    const { batchSize, scoreThreshold } = req.body;
    
    // Test setting controls
    const results = {
      before: {
        batchSize: orchestrator['maxItemsPerBatch'],
        scoreThreshold: orchestrator['minScoreThreshold']
      },
      actions: [],
      after: {}
    };
    
    // Set batch size if provided
    if (batchSize) {
      orchestrator.setBatchSize(batchSize);
      results.actions.push(`Set batch size to ${batchSize}`);
    }
    
    // Set score threshold if provided
    if (scoreThreshold) {
      orchestrator.setScoreThreshold(scoreThreshold);
      results.actions.push(`Set score threshold to ${scoreThreshold}`);
    }
    
    // Get new values
    results.after = {
      batchSize: orchestrator['maxItemsPerBatch'],
      scoreThreshold: orchestrator['minScoreThreshold']
    };
    
    res.json({
      success: true,
      message: 'Manual controls tested',
      results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}