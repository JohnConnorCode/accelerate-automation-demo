import { VercelRequest, VercelResponse } from '@vercel/node';
import { SchedulingService } from '../src/services/scheduling-service';

const scheduler = new SchedulingService();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Get scheduler status
  if (req.method === 'GET') {
    try {
      const status = await scheduler.getStatus();
      
      return res.status(200).json({
        success: true,
        ...status,
        humanReadable: {
          mode: status.config.manualOnly ? 'MANUAL ONLY' : 'AUTOMATIC',
          frequency: status.config.manualOnly ? 'On-demand' : `Every ${status.config.intervalHours} hours`,
          nextRun: status.config.manualOnly ? 'Manual trigger required' : status.nextRun
        }
      });
    } catch (error) {
      return res.status(500).json({ 
        error: 'Failed to get scheduler status',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Update schedule configuration
  if (req.method === 'PUT') {
    try {
      const {
        enabled,
        intervalHours,
        manualOnly,
        autoQualityChecks,
        autoAIAssessment,
        notifyOnComplete,
        maxItemsPerRun
      } = req.body;

      // Validate interval
      if (intervalHours !== undefined) {
        if (intervalHours < 1 || intervalHours > 168) {
          return res.status(400).json({
            error: 'Invalid interval',
            message: 'Interval must be between 1 and 168 hours (1 week)'
          });
        }
      }

      const updates: any = {};
      if (enabled !== undefined) updates.enabled = enabled;
      if (intervalHours !== undefined) updates.intervalHours = intervalHours;
      if (manualOnly !== undefined) updates.manualOnly = manualOnly;
      if (autoQualityChecks !== undefined) updates.autoQualityChecks = autoQualityChecks;
      if (autoAIAssessment !== undefined) updates.autoAIAssessment = autoAIAssessment;
      if (notifyOnComplete !== undefined) updates.notifyOnComplete = notifyOnComplete;
      if (maxItemsPerRun !== undefined) updates.maxItemsPerRun = maxItemsPerRun;

      const config = await scheduler.updateSchedule(updates);

      return res.status(200).json({
        success: true,
        message: 'Schedule updated successfully',
        config,
        humanReadable: {
          mode: config.manualOnly ? 'MANUAL ONLY' : 'AUTOMATIC',
          frequency: config.manualOnly ? 'On-demand' : `Every ${config.intervalHours} hours`,
          nextRun: config.manualOnly ? 'Manual trigger required' : config.nextRun
        }
      });
    } catch (error) {
      return res.status(500).json({ 
        error: 'Failed to update schedule',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Trigger manual run
  if (req.method === 'POST' && req.body.action === 'run_now') {
    try {
      const {
        skipFetch,
        skipQualityChecks,
        skipAI,
        sources
      } = req.body.options || {};

      console.log('[API] CEO triggered manual run with options:', req.body.options);

      const result = await scheduler.runManualUpdate({
        skipFetch,
        skipQualityChecks,
        skipAI,
        sources
      });

      return res.status(200).json({
        success: true,
        message: 'Manual run triggered by CEO',
        ...result
      });
    } catch (error) {
      return res.status(500).json({ 
        error: 'Failed to trigger manual run',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Enable/disable scheduler
  if (req.method === 'POST' && req.body.action === 'toggle') {
    try {
      const enabled = req.body.enabled;
      await scheduler.setEnabled(enabled);

      return res.status(200).json({
        success: true,
        message: enabled ? 'Scheduler enabled' : 'Scheduler disabled',
        enabled
      });
    } catch (error) {
      return res.status(500).json({ 
        error: 'Failed to toggle scheduler',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Set manual-only mode
  if (req.method === 'POST' && req.body.action === 'set_manual_only') {
    try {
      const manualOnly = req.body.manualOnly;
      await scheduler.setManualOnly(manualOnly);

      return res.status(200).json({
        success: true,
        message: manualOnly 
          ? 'MANUAL-ONLY mode activated - no automatic runs' 
          : 'Automatic mode activated',
        manualOnly
      });
    } catch (error) {
      return res.status(500).json({ 
        error: 'Failed to set manual mode',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}