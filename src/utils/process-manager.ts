/**
 * Process Manager for graceful shutdown and error recovery
 */

import { logger } from '../services/logger';

export class ProcessManager {
  private shutdownHandlers: Array<() => Promise<void>> = [];
  private isShuttingDown = false;

  /**
   * Register a cleanup handler for graceful shutdown
   */
  onShutdown(handler: () => Promise<void>): void {
    this.shutdownHandlers.push(handler);
  }

  /**
   * Initialize process error handlers
   */
  initialize(): void {
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      
      // Give logger time to write
      setTimeout(() => {
        this.shutdown(1);
      }, 1000);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      
      // Don't exit on unhandled rejection, just log it
      // In production, you might want to exit after logging
    });

    // Handle termination signals
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully...');
      this.shutdown(0);
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down gracefully...');
      this.shutdown(0);
    });

    // Handle nodemon restarts
    process.on('SIGUSR2', () => {
      logger.info('SIGUSR2 received, restarting...');
      this.shutdown(0);
    });

    logger.info('Process manager initialized with error recovery');
  }

  /**
   * Gracefully shutdown the application
   */
  private async shutdown(exitCode: number): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    logger.info('Starting graceful shutdown...');

    // Run all cleanup handlers
    for (const handler of this.shutdownHandlers) {
      try {
        await handler();
      } catch (error) {
        logger.error('Error during shutdown handler:', error);
      }
    }

    logger.info('Graceful shutdown complete');
    process.exit(exitCode);
  }

  /**
   * Health check to ensure process is responsive
   */
  isHealthy(): boolean {
    // Check memory usage
    const memUsage = process.memoryUsage();
    const maxHeapMB = 512; // Max heap size in MB
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
    
    if (heapUsedMB > maxHeapMB) {
      logger.warn(`High memory usage: ${heapUsedMB.toFixed(2)}MB`);
      return false;
    }

    // Check event loop lag (simplified)
    const start = Date.now();
    setImmediate(() => {
      const lag = Date.now() - start;
      if (lag > 100) {
        logger.warn(`High event loop lag: ${lag}ms`);
      }
    });

    return true;
  }

  /**
   * Restart the process (for critical errors)
   */
  restart(): void {
    logger.info('Restarting process...');
    
    // In production, use PM2 or similar
    // For development, just exit and let nodemon restart
    process.exit(1);
  }
}

// Export singleton
export const processManager = new ProcessManager();