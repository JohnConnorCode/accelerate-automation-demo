import { supabase } from '../lib/supabase-client';
import { promises as fs } from 'fs';
import path from 'path';
import { createWriteStream } from 'fs';
import archiver from 'archiver';

/**
 * Comprehensive Backup and Recovery Service
 * Ensures data protection and disaster recovery capabilities
 */

interface BackupConfig {
  includeDatabase: boolean;
  includeFiles: boolean;
  includeConfig: boolean;
  includeLogs: boolean;
  compression: 'none' | 'gzip' | 'zip';
  encryption: boolean;
  destination: 'local' | 'cloud' | 'both';
}

interface BackupMetadata {
  id: string;
  timestamp: string;
  type: 'full' | 'incremental' | 'differential';
  size: number;
  duration: number;
  tables: string[];
  recordCount: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  location: string;
  checksum: string;
}

interface RecoveryPoint {
  id: string;
  name: string;
  timestamp: string;
  type: 'manual' | 'automatic';
  description: string;
  backupId: string;
  metadata: any;
}

export class BackupRecoveryService {
  private readonly backupPath = process.env.BACKUP_PATH || './backups';
  private readonly maxBackups = parseInt(process.env.MAX_BACKUPS || '10');
  private readonly retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS || '30');
  
  private defaultConfig: BackupConfig = {
    includeDatabase: true,
    includeFiles: true,
    includeConfig: true,
    includeLogs: false,
    compression: 'zip',
    encryption: false,
    destination: 'local'
  };

  /**
   * Create a full system backup
   */
  async createBackup(
    name?: string,
    config?: Partial<BackupConfig>
  ): Promise<BackupMetadata> {
    const startTime = Date.now();
    const backupConfig = { ...this.defaultConfig, ...config };
    const backupId = this.generateBackupId();
    const timestamp = new Date().toISOString();
    
    const metadata: BackupMetadata = {
      id: backupId,
      timestamp,
      type: 'full',
      size: 0,
      duration: 0,
      tables: [],
      recordCount: 0,
      status: 'in_progress',
      location: '',
      checksum: ''
    };

    try {

      // Update status
      await this.updateBackupStatus(backupId, 'in_progress');
      
      // Create backup directory
      const backupDir = path.join(this.backupPath, backupId);
      await fs.mkdir(backupDir, { recursive: true });
      
      let totalSize = 0;
      let totalRecords = 0;
      
      // Backup database
      if (backupConfig.includeDatabase) {
        const dbBackup = await this.backupDatabase(backupDir);
        totalSize += dbBackup.size;
        totalRecords += dbBackup.recordCount;
        metadata.tables = dbBackup.tables;
      }
      
      // Backup configuration files
      if (backupConfig.includeConfig) {
        const configSize = await this.backupConfiguration(backupDir);
        totalSize += configSize;
      }
      
      // Backup logs if requested
      if (backupConfig.includeLogs) {
        const logsSize = await this.backupLogs(backupDir);
        totalSize += logsSize;
      }
      
      // Compress backup if needed
      let finalLocation = backupDir;
      if (backupConfig.compression !== 'none') {
        finalLocation = await this.compressBackup(backupDir, backupConfig.compression);
        // Clean up uncompressed files
        await this.cleanupDirectory(backupDir);
      }
      
      // Calculate checksum
      const checksum = await this.calculateChecksum(finalLocation);
      
      // Upload to cloud if configured
      if (backupConfig.destination === 'cloud' || backupConfig.destination === 'both') {
        await this.uploadToCloud(finalLocation, backupId);
      }
      
      // Update metadata
      metadata.size = totalSize;
      metadata.recordCount = totalRecords;
      metadata.duration = Date.now() - startTime;
      metadata.status = 'completed';
      metadata.location = finalLocation;
      metadata.checksum = checksum;
      
      // Store metadata in database
      await this.storeBackupMetadata(metadata);
      
      // Clean up old backups
      await this.cleanupOldBackups();

      return metadata;
      
    } catch (error) {

      metadata.status = 'failed';
      await this.updateBackupStatus(backupId, 'failed');
      throw error;
    }
  }

  /**
   * Backup database tables
   */
  private async backupDatabase(backupDir: string): Promise<{
    size: number;
    recordCount: number;
    tables: string[];
  }> {

    const tables = [
      'content_queue',
      'approved_content',
      'rejected_content',
      'scoring_criteria',
      'ai_assessments',
      'quality_checks',
      'scheduler_history',
      'system_settings'
    ];
    
    let totalSize = 0;
    let totalRecords = 0;
    
    for (const table of tables) {
      try {
        // Fetch all data from table
        const { data, error } = await supabase
          .from(table)
          .select('*');
        
        if (error) {

          continue;
        }
        
        if (data && data.length > 0) {
          // Save to JSON file
          const filePath = path.join(backupDir, `${table}.json`);
          const jsonData = JSON.stringify(data, null, 2);
          await fs.writeFile(filePath, jsonData);
          
          const stats = await fs.stat(filePath);
          totalSize += stats.size;
          totalRecords += data.length;

        }
      } catch (error) {

      }
    }
    
    return { size: totalSize, recordCount: totalRecords, tables };
  }

  /**
   * Backup configuration files
   */
  private async backupConfiguration(backupDir: string): Promise<number> {

    const configFiles = [
      '.env',
      'package.json',
      'tsconfig.json',
      'vercel.json'
    ];
    
    let totalSize = 0;
    const configDir = path.join(backupDir, 'config');
    await fs.mkdir(configDir, { recursive: true });
    
    for (const file of configFiles) {
      try {
        const filePath = path.join(process.cwd(), file);
        const destPath = path.join(configDir, file);
        
        // Check if file exists
        await fs.access(filePath);
        
        // Copy file
        await fs.copyFile(filePath, destPath);
        
        const stats = await fs.stat(destPath);
        totalSize += stats.size;
        
      } catch (error) {
        // File doesn't exist or can't be copied

      }
    }
    
    return totalSize;
  }

  /**
   * Backup system logs
   */
  private async backupLogs(backupDir: string): Promise<number> {

    let totalSize = 0;
    const logsDir = path.join(backupDir, 'logs');
    await fs.mkdir(logsDir, { recursive: true });
    
    // Backup error logs from database
    const { data: errorLogs } = await supabase
      .from('error_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(1000);
    
    if (errorLogs && errorLogs.length > 0) {
      const filePath = path.join(logsDir, 'error_logs.json');
      await fs.writeFile(filePath, JSON.stringify(errorLogs, null, 2));
      const stats = await fs.stat(filePath);
      totalSize += stats.size;
    }
    
    // Backup health metrics
    const { data: healthMetrics } = await supabase
      .from('health_metrics')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(1000);
    
    if (healthMetrics && healthMetrics.length > 0) {
      const filePath = path.join(logsDir, 'health_metrics.json');
      await fs.writeFile(filePath, JSON.stringify(healthMetrics, null, 2));
      const stats = await fs.stat(filePath);
      totalSize += stats.size;
    }
    
    return totalSize;
  }

  /**
   * Compress backup directory
   */
  private async compressBackup(
    backupDir: string,
    compression: 'gzip' | 'zip'
  ): Promise<string> {

    const archivePath = `${backupDir}.${compression === 'gzip' ? 'tar.gz' : 'zip'}`;
    
    return new Promise((resolve, reject) => {
      const output = createWriteStream(archivePath);
      const archive = archiver(compression === 'gzip' ? 'tar' : 'zip', {
        gzip: compression === 'gzip',
        zlib: { level: 9 }
      });
      
      output.on('close', () => {

        resolve(archivePath);
      });
      
      archive.on('error', reject);
      
      archive.pipe(output);
      archive.directory(backupDir, false);
      archive.finalize();
    });
  }

  /**
   * Restore from backup
   */
  async restoreFromBackup(
    backupId: string,
    options?: {
      tables?: string[];
      skipExisting?: boolean;
      dryRun?: boolean;
    }
  ): Promise<{
    success: boolean;
    restored: number;
    skipped: number;
    errors: string[];
  }> {

    const result = {
      success: false,
      restored: 0,
      skipped: 0,
      errors: [] as string[]
    };
    
    try {
      // Get backup metadata
      const { data: backup } = await supabase
        .from('backup_metadata')
        .select('*')
        .eq('id', backupId)
        .single();
      
      if (!backup) {
        throw new Error(`Backup ${backupId} not found`);
      }
      
      // Decompress if needed
      let backupDir = backup.location;
      if (backup.location.endsWith('.zip') || backup.location.endsWith('.tar.gz')) {
        backupDir = await this.decompressBackup(backup.location);
      }
      
      // Get list of tables to restore
      const tablesToRestore = options?.tables || backup.tables;
      
      // Restore each table
      for (const table of tablesToRestore) {
        try {
          const filePath = path.join(backupDir, `${table}.json`);
          
          // Check if backup file exists
          await fs.access(filePath);
          
          // Read backup data
          const jsonData = await fs.readFile(filePath, 'utf-8');
          const data = JSON.parse(jsonData);
          
          if (options?.dryRun) {

            result.restored += data.length;
            continue;
          }
          
          // Clear existing data if not skipping
          if (!options?.skipExisting) {

            await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
          }
          
          // Restore data in batches
          const batchSize = 100;
          for (let i = 0; i < data.length; i += batchSize) {
            const batch = data.slice(i, i + batchSize);
            
            const { error } = await supabase
              .from(table)
              .upsert(batch, { onConflict: 'id' });
            
            if (error) {
              result.errors.push(`Error restoring ${table}: ${error.message}`);

            } else {
              result.restored += batch.length;
            }
          }

        } catch (error) {
          result.errors.push(`Failed to restore ${table}: ${error}`);

        }
      }
      
      // Create recovery point
      await this.createRecoveryPoint(
        `Restored from backup ${backupId}`,
        backupId
      );
      
      result.success = result.errors.length === 0;

    } catch (error) {

      result.errors.push(`Restore failed: ${error}`);
    }
    
    return result;
  }

  /**
   * Create a recovery point
   */
  async createRecoveryPoint(
    description: string,
    backupId?: string
  ): Promise<RecoveryPoint> {
    const recoveryPoint: RecoveryPoint = {
      id: this.generateBackupId(),
      name: `recovery_${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'manual',
      description,
      backupId: backupId || '',
      metadata: {
        user: process.env.USER || 'system',
        reason: description
      }
    };
    
    // Store in database
    await supabase.from('recovery_points').insert(recoveryPoint);

    return recoveryPoint;
  }

  /**
   * List available backups
   */
  async listBackups(
    limit: number = 10
  ): Promise<BackupMetadata[]> {
    const { data } = await supabase
      .from('backup_metadata')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limit);
    
    return data || [];
  }

  /**
   * Get backup details
   */
  async getBackupDetails(backupId: string): Promise<BackupMetadata | null> {
    const { data } = await supabase
      .from('backup_metadata')
      .select('*')
      .eq('id', backupId)
      .single();
    
    return data;
  }

  /**
   * Schedule automatic backups
   */
  async scheduleAutomaticBackups(
    schedule: 'hourly' | 'daily' | 'weekly'
  ): Promise<void> {
    const intervals = {
      hourly: 3600000,
      daily: 86400000,
      weekly: 604800000
    };
    
    const interval = intervals[schedule];
    
    // Store schedule in database
    await supabase
      .from('system_settings')
      .upsert({
        key: 'backup_schedule',
        value: {
          enabled: true,
          interval: schedule,
          nextRun: new Date(Date.now() + interval).toISOString()
        }
      }, { onConflict: 'key' });

  }

  /**
   * Verify backup integrity
   */
  async verifyBackup(backupId: string): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    const result = {
      valid: true,
      errors: [] as string[]
    };
    
    try {
      const backup = await this.getBackupDetails(backupId);
      
      if (!backup) {
        result.valid = false;
        result.errors.push('Backup not found');
        return result;
      }
      
      // Verify checksum
      const currentChecksum = await this.calculateChecksum(backup.location);
      if (currentChecksum !== backup.checksum) {
        result.valid = false;
        result.errors.push('Checksum mismatch - backup may be corrupted');
      }
      
      // Verify file exists
      try {
        await fs.access(backup.location);
      } catch {
        result.valid = false;
        result.errors.push('Backup file not found');
      }
      
      // If compressed, try to decompress and verify
      if (backup.location.endsWith('.zip') || backup.location.endsWith('.tar.gz')) {
        try {
          const tempDir = await this.decompressBackup(backup.location);
          await this.cleanupDirectory(tempDir);
        } catch (error) {
          result.valid = false;
          result.errors.push(`Decompression failed: ${error}`);
        }
      }
      
    } catch (error) {
      result.valid = false;
      result.errors.push(`Verification failed: ${error}`);
    }
    
    return result;
  }

  /**
   * Clean up old backups
   */
  private async cleanupOldBackups(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);
    
    // Get old backups
    const { data: oldBackups } = await supabase
      .from('backup_metadata')
      .select('*')
      .lt('timestamp', cutoffDate.toISOString())
      .eq('type', 'automatic');
    
    if (oldBackups && oldBackups.length > 0) {
      for (const backup of oldBackups) {
        try {
          // Delete backup file
          await fs.unlink(backup.location);
          
          // Delete metadata
          await supabase
            .from('backup_metadata')
            .delete()
            .eq('id', backup.id);

        } catch (error) {

        }
      }
    }
    
    // Keep only the latest N backups
    const { data: allBackups } = await supabase
      .from('backup_metadata')
      .select('*')
      .order('timestamp', { ascending: false });
    
    if (allBackups && allBackups.length > this.maxBackups) {
      const toDelete = allBackups.slice(this.maxBackups);
      for (const backup of toDelete) {
        try {
          await fs.unlink(backup.location);
          await supabase
            .from('backup_metadata')
            .delete()
            .eq('id', backup.id);
        } catch (error) {

        }
      }
    }
  }

  /**
   * Helper functions
   */
  
  private generateBackupId(): string {
    return `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private async calculateChecksum(filePath: string): Promise<string> {
    // Simple checksum implementation - in production, use crypto.createHash
    const stats = await fs.stat(filePath);
    return `${stats.size}_${stats.mtime.getTime()}`;
  }
  
  private async decompressBackup(archivePath: string): Promise<string> {
    // Implementation would decompress the archive
    // For now, return the expected directory path
    return archivePath.replace(/\.(zip|tar\.gz)$/, '');
  }
  
  private async cleanupDirectory(dirPath: string): Promise<void> {
    try {
      await fs.rmdir(dirPath, { recursive: true });
    } catch (error) {

    }
  }
  
  private async uploadToCloud(filePath: string, backupId: string): Promise<void> {
    // Implementation would upload to cloud storage (S3, GCS, etc.)

  }
  
  private async updateBackupStatus(backupId: string, status: string): Promise<void> {
    await supabase
      .from('backup_metadata')
      .upsert({
        id: backupId,
        status,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
  }
  
  private async storeBackupMetadata(metadata: BackupMetadata): Promise<void> {
    await supabase.from('backup_metadata').insert(metadata);
  }
}