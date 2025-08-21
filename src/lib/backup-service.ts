import { supabase } from './supabase';
import { notificationService } from './notification-service';
import fs from 'fs/promises';
import path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { createGzip, createGunzip } from 'zlib';

interface BackupMetadata {
  id: string;
  timestamp: Date;
  tables: string[];
  rowCounts: Record<string, number>;
  size: number;
  compressed: boolean;
  location: string;
  type: 'full' | 'incremental';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  error?: string;
}

interface RestoreOptions {
  tables?: string[];
  overwrite?: boolean;
  dryRun?: boolean;
}

export class BackupService {
  private backupDir: string;
  private maxBackups: number;
  private compressionEnabled: boolean;
  private isRunning: boolean = false;

  constructor() {
    this.backupDir = process.env.BACKUP_DIR || './backups';
    this.maxBackups = parseInt(process.env.MAX_BACKUPS || '30');
    this.compressionEnabled = process.env.ENABLE_COMPRESSION !== 'false';
  }

  /**
   * Create a full backup of all content tables
   */
  async createFullBackup(): Promise<BackupMetadata> {
    if (this.isRunning) {
      throw new Error('Backup already in progress');
    }

    this.isRunning = true;
    const backupId = `backup_${Date.now()}`;
    const metadata: BackupMetadata = {
      id: backupId,
      timestamp: new Date(),
      tables: [],
      rowCounts: {},
      size: 0,
      compressed: this.compressionEnabled,
      location: '',
      type: 'full',
      status: 'in_progress',
    };

    try {
      console.log(`[Backup] Starting full backup ${backupId}`);
      await this.ensureBackupDirectory();

      // Tables to backup
      const tables = [
        'content_queue',
        'resources',
        'projects',
        'funding_programs',
        'fetch_history',
        'ai_processing_log',
        'user_interactions',
        'content_reports',
        'analytics_daily',
        'webhook_endpoints',
        'webhook_deliveries',
        'monitoring_alerts',
        'monitoring_metrics',
      ];

      const backupData: Record<string, any[]> = {};

      // Fetch data from each table
      for (const table of tables) {
        try {
          const { data, error, count } = await supabase
            .from(table)
            .select('*', { count: 'exact' });

          if (error) {
            console.error(`[Backup] Error backing up ${table}:`, error);
            continue;
          }

          backupData[table] = data || [];
          metadata.tables.push(table);
          metadata.rowCounts[table] = count || 0;
          
          console.log(`[Backup] Backed up ${count} rows from ${table}`);
        } catch (error) {
          console.error(`[Backup] Failed to backup ${table}:`, error);
        }
      }

      // Save backup to file
      const backupPath = path.join(this.backupDir, `${backupId}.json`);
      const backupContent = JSON.stringify({
        metadata: {
          ...metadata,
          version: '1.0',
          created_at: new Date().toISOString(),
        },
        data: backupData,
      }, null, 2);

      if (this.compressionEnabled) {
        // Compress backup
        const compressedPath = `${backupPath}.gz`;
        await this.compressFile(backupPath, compressedPath, backupContent);
        metadata.location = compressedPath;
        
        const stats = await fs.stat(compressedPath);
        metadata.size = stats.size;
      } else {
        await fs.writeFile(backupPath, backupContent);
        metadata.location = backupPath;
        
        const stats = await fs.stat(backupPath);
        metadata.size = stats.size;
      }

      metadata.status = 'completed';
      
      // Log backup completion
      await this.logBackup(metadata);
      
      // Clean up old backups
      await this.cleanupOldBackups();
      
      // Send notification
      await notificationService.sendEmail(
        process.env.ADMIN_EMAIL!,
        'Backup Completed',
        `Full backup ${backupId} completed successfully.\n\nTables: ${metadata.tables.length}\nTotal rows: ${Object.values(metadata.rowCounts).reduce((a, b) => a + b, 0)}\nSize: ${(metadata.size / 1024 / 1024).toFixed(2)}MB`
      );

      console.log(`[Backup] Full backup completed: ${backupId}`);
      return metadata;

    } catch (error: any) {
      metadata.status = 'failed';
      metadata.error = error.message;
      
      await this.logBackup(metadata);
      
      console.error('[Backup] Backup failed:', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Create an incremental backup since last full backup
   */
  async createIncrementalBackup(sinceTimestamp?: Date): Promise<BackupMetadata> {
    if (this.isRunning) {
      throw new Error('Backup already in progress');
    }

    this.isRunning = true;
    const backupId = `incremental_${Date.now()}`;
    const metadata: BackupMetadata = {
      id: backupId,
      timestamp: new Date(),
      tables: [],
      rowCounts: {},
      size: 0,
      compressed: this.compressionEnabled,
      location: '',
      type: 'incremental',
      status: 'in_progress',
    };

    try {
      console.log(`[Backup] Starting incremental backup ${backupId}`);
      await this.ensureBackupDirectory();

      // Determine cutoff timestamp
      const cutoff = sinceTimestamp || await this.getLastBackupTimestamp();
      if (!cutoff) {
        console.log('[Backup] No previous backup found, creating full backup instead');
        return this.createFullBackup();
      }

      const backupData: Record<string, any[]> = {};

      // Tables with timestamps to backup incrementally
      const incrementalTables = [
        { name: 'content_queue', field: 'created_at' },
        { name: 'resources', field: 'created_at' },
        { name: 'projects', field: 'created_at' },
        { name: 'funding_programs', field: 'created_at' },
        { name: 'fetch_history', field: 'created_at' },
        { name: 'ai_processing_log', field: 'created_at' },
        { name: 'user_interactions', field: 'created_at' },
        { name: 'monitoring_alerts', field: 'created_at' },
        { name: 'monitoring_metrics', field: 'timestamp' },
      ];

      for (const table of incrementalTables) {
        try {
          const { data, error, count } = await supabase
            .from(table.name)
            .select('*', { count: 'exact' })
            .gte(table.field, cutoff.toISOString());

          if (error) {
            console.error(`[Backup] Error backing up ${table.name}:`, error);
            continue;
          }

          if (data && data.length > 0) {
            backupData[table.name] = data;
            metadata.tables.push(table.name);
            metadata.rowCounts[table.name] = count || 0;
            
            console.log(`[Backup] Backed up ${count} new rows from ${table.name}`);
          }
        } catch (error) {
          console.error(`[Backup] Failed to backup ${table.name}:`, error);
        }
      }

      // Save incremental backup
      const backupPath = path.join(this.backupDir, `${backupId}.json`);
      const backupContent = JSON.stringify({
        metadata: {
          ...metadata,
          version: '1.0',
          created_at: new Date().toISOString(),
          since_timestamp: cutoff.toISOString(),
        },
        data: backupData,
      }, null, 2);

      if (this.compressionEnabled) {
        const compressedPath = `${backupPath}.gz`;
        await this.compressFile(backupPath, compressedPath, backupContent);
        metadata.location = compressedPath;
        
        const stats = await fs.stat(compressedPath);
        metadata.size = stats.size;
      } else {
        await fs.writeFile(backupPath, backupContent);
        metadata.location = backupPath;
        
        const stats = await fs.stat(backupPath);
        metadata.size = stats.size;
      }

      metadata.status = 'completed';
      await this.logBackup(metadata);

      console.log(`[Backup] Incremental backup completed: ${backupId}`);
      return metadata;

    } catch (error: any) {
      metadata.status = 'failed';
      metadata.error = error.message;
      
      await this.logBackup(metadata);
      
      console.error('[Backup] Incremental backup failed:', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Restore from a backup
   */
  async restoreFromBackup(backupId: string, options: RestoreOptions = {}): Promise<void> {
    const { tables, overwrite = false, dryRun = false } = options;

    try {
      console.log(`[Restore] Starting restore from ${backupId}`);
      
      // Find backup file
      const backupFiles = await fs.readdir(this.backupDir);
      const backupFile = backupFiles.find(f => f.includes(backupId));
      
      if (!backupFile) {
        throw new Error(`Backup ${backupId} not found`);
      }

      const backupPath = path.join(this.backupDir, backupFile);
      
      // Read and decompress if needed
      let backupContent: string;
      if (backupFile.endsWith('.gz')) {
        backupContent = await this.decompressFile(backupPath);
      } else {
        backupContent = await fs.readFile(backupPath, 'utf-8');
      }

      const backup = JSON.parse(backupContent);
      const { metadata: backupMeta, data: backupData } = backup;

      console.log(`[Restore] Backup info: Type=${backupMeta.type}, Tables=${Object.keys(backupData).length}, Created=${backupMeta.created_at}`);

      if (dryRun) {
        console.log('[Restore] Dry run mode - no changes will be made');
        for (const [table, rows] of Object.entries(backupData)) {
          if (tables && !tables.includes(table)) continue;
          console.log(`[Restore] Would restore ${(rows as any[]).length} rows to ${table}`);
        }
        return;
      }

      // Restore each table
      for (const [table, rows] of Object.entries(backupData)) {
        if (tables && !tables.includes(table)) {
          console.log(`[Restore] Skipping ${table} (not in restore list)`);
          continue;
        }

        const rowArray = rows as any[];
        if (rowArray.length === 0) {
          console.log(`[Restore] Skipping ${table} (no rows)`);
          continue;
        }

        console.log(`[Restore] Restoring ${rowArray.length} rows to ${table}`);

        if (overwrite) {
          // Delete existing data first
          console.log(`[Restore] Clearing existing data from ${table}`);
          const { error: deleteError } = await supabase
            .from(table)
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

          if (deleteError) {
            console.error(`[Restore] Error clearing ${table}:`, deleteError);
            continue;
          }
        }

        // Insert in batches to avoid payload size limits
        const batchSize = 100;
        for (let i = 0; i < rowArray.length; i += batchSize) {
          const batch = rowArray.slice(i, i + batchSize);
          
          const { error: insertError } = await supabase
            .from(table)
            .upsert(batch, { 
              onConflict: 'id',
              ignoreDuplicates: !overwrite 
            });

          if (insertError) {
            console.error(`[Restore] Error restoring ${table} batch ${i / batchSize}:`, insertError);
          } else {
            console.log(`[Restore] Restored batch ${i / batchSize + 1} of ${Math.ceil(rowArray.length / batchSize)}`);
          }
        }
      }

      // Log restore
      await supabase
        .from('backup_restore_log')
        .insert({
          backup_id: backupId,
          restored_at: new Date().toISOString(),
          tables_restored: Object.keys(backupData),
          options,
          success: true,
        });

      console.log(`[Restore] Restore completed from ${backupId}`);
      
      // Send notification
      await notificationService.sendEmail(
        process.env.ADMIN_EMAIL!,
        'Restore Completed',
        `Database restored from backup ${backupId}.\n\nTables restored: ${Object.keys(backupData).join(', ')}`
      );

    } catch (error: any) {
      console.error('[Restore] Restore failed:', error);
      
      // Log failed restore
      await supabase
        .from('backup_restore_log')
        .insert({
          backup_id: backupId,
          restored_at: new Date().toISOString(),
          options,
          success: false,
          error: error.message,
        });

      throw error;
    }
  }

  /**
   * List available backups
   */
  async listBackups(): Promise<BackupMetadata[]> {
    try {
      await this.ensureBackupDirectory();
      
      const files = await fs.readdir(this.backupDir);
      const backups: BackupMetadata[] = [];

      for (const file of files) {
        if (file.endsWith('.json') || file.endsWith('.json.gz')) {
          const filePath = path.join(this.backupDir, file);
          const stats = await fs.stat(filePath);
          
          // Try to read metadata from file
          let metadata: BackupMetadata | null = null;
          
          try {
            let content: string;
            if (file.endsWith('.gz')) {
              content = await this.decompressFile(filePath);
            } else {
              content = await fs.readFile(filePath, 'utf-8');
            }
            
            const backup = JSON.parse(content);
            metadata = {
              id: file.replace(/\.(json|json\.gz)$/, ''),
              timestamp: new Date(backup.metadata.created_at),
              tables: backup.metadata.tables || Object.keys(backup.data),
              rowCounts: backup.metadata.rowCounts || {},
              size: stats.size,
              compressed: file.endsWith('.gz'),
              location: filePath,
              type: backup.metadata.type || 'full',
              status: 'completed',
            };
          } catch {
            // Fallback to basic metadata
            metadata = {
              id: file.replace(/\.(json|json\.gz)$/, ''),
              timestamp: stats.mtime,
              tables: [],
              rowCounts: {},
              size: stats.size,
              compressed: file.endsWith('.gz'),
              location: filePath,
              type: file.includes('incremental') ? 'incremental' : 'full',
              status: 'completed',
            };
          }
          
          backups.push(metadata);
        }
      }

      // Sort by timestamp descending
      backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      
      return backups;
    } catch (error) {
      console.error('[Backup] Error listing backups:', error);
      return [];
    }
  }

  /**
   * Delete a specific backup
   */
  async deleteBackup(backupId: string): Promise<void> {
    try {
      const backups = await this.listBackups();
      const backup = backups.find(b => b.id === backupId);
      
      if (!backup) {
        throw new Error(`Backup ${backupId} not found`);
      }

      await fs.unlink(backup.location);
      console.log(`[Backup] Deleted backup ${backupId}`);
    } catch (error) {
      console.error(`[Backup] Error deleting backup ${backupId}:`, error);
      throw error;
    }
  }

  /**
   * Verify backup integrity
   */
  async verifyBackup(backupId: string): Promise<boolean> {
    try {
      const backups = await this.listBackups();
      const backup = backups.find(b => b.id === backupId);
      
      if (!backup) {
        throw new Error(`Backup ${backupId} not found`);
      }

      // Read and parse backup
      let content: string;
      if (backup.compressed) {
        content = await this.decompressFile(backup.location);
      } else {
        content = await fs.readFile(backup.location, 'utf-8');
      }

      const data = JSON.parse(content);
      
      // Verify structure
      if (!data.metadata || !data.data) {
        console.error(`[Backup] Invalid backup structure for ${backupId}`);
        return false;
      }

      // Verify row counts
      for (const [table, rows] of Object.entries(data.data)) {
        const rowArray = rows as any[];
        if (data.metadata.rowCounts && data.metadata.rowCounts[table] !== rowArray.length) {
          console.error(`[Backup] Row count mismatch for ${table} in ${backupId}`);
          return false;
        }
      }

      console.log(`[Backup] Backup ${backupId} verified successfully`);
      return true;
    } catch (error) {
      console.error(`[Backup] Error verifying backup ${backupId}:`, error);
      return false;
    }
  }

  // Helper methods

  private async ensureBackupDirectory(): Promise<void> {
    try {
      await fs.access(this.backupDir);
    } catch {
      await fs.mkdir(this.backupDir, { recursive: true });
    }
  }

  private async compressFile(outputPath: string, compressedPath: string, content: string): Promise<void> {
    const tempPath = `${outputPath}.tmp`;
    await fs.writeFile(tempPath, content);
    
    await pipeline(
      createReadStream(tempPath),
      createGzip({ level: 9 }),
      createWriteStream(compressedPath)
    );
    
    await fs.unlink(tempPath);
  }

  private async decompressFile(compressedPath: string): Promise<string> {
    const chunks: Buffer[] = [];
    
    await pipeline(
      createReadStream(compressedPath),
      createGunzip(),
      async function* (source) {
        for await (const chunk of source) {
          chunks.push(chunk);
          yield chunk;
        }
      }
    );
    
    return Buffer.concat(chunks).toString('utf-8');
  }

  private async getLastBackupTimestamp(): Promise<Date | null> {
    const backups = await this.listBackups();
    const fullBackups = backups.filter(b => b.type === 'full');
    
    if (fullBackups.length === 0) {
      return null;
    }
    
    return fullBackups[0].timestamp;
  }

  private async cleanupOldBackups(): Promise<void> {
    try {
      const backups = await this.listBackups();
      
      if (backups.length <= this.maxBackups) {
        return;
      }

      // Keep most recent backups
      const toDelete = backups.slice(this.maxBackups);
      
      for (const backup of toDelete) {
        await fs.unlink(backup.location);
        console.log(`[Backup] Deleted old backup ${backup.id}`);
      }
    } catch (error) {
      console.error('[Backup] Error cleaning up old backups:', error);
    }
  }

  private async logBackup(metadata: BackupMetadata): Promise<void> {
    try {
      await supabase
        .from('backup_log')
        .insert({
          backup_id: metadata.id,
          backup_type: metadata.type,
          status: metadata.status,
          tables: metadata.tables,
          row_counts: metadata.rowCounts,
          size_bytes: metadata.size,
          location: metadata.location,
          error: metadata.error,
          created_at: metadata.timestamp.toISOString(),
        });
    } catch (error) {
      console.error('[Backup] Error logging backup:', error);
    }
  }

  /**
   * Schedule automatic backups
   */
  startScheduledBackups(): void {
    // Daily full backup at 2 AM
    const dailyBackup = setInterval(async () => {
      const now = new Date();
      if (now.getHours() === 2 && now.getMinutes() === 0) {
        try {
          await this.createFullBackup();
        } catch (error) {
          console.error('[Backup] Scheduled backup failed:', error);
        }
      }
    }, 60000); // Check every minute

    // Hourly incremental backup
    const hourlyBackup = setInterval(async () => {
      const now = new Date();
      if (now.getMinutes() === 0) {
        try {
          await this.createIncrementalBackup();
        } catch (error) {
          console.error('[Backup] Scheduled incremental backup failed:', error);
        }
      }
    }, 60000); // Check every minute

    console.log('[Backup] Scheduled backups started');
  }
}

// Export singleton
export const backupService = new BackupService();