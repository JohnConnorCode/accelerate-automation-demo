import winston from 'winston'
import path from 'path'

const logLevel = process.env.LOG_LEVEL || 'info'
const logFilePath = process.env.LOG_FILE_PATH || './logs/app.log'
const auditLogPath = process.env.AUDIT_LOG_PATH || './logs/audit.log'

// Create logs directory if it doesn't exist
import fs from 'fs'
const logDir = path.dirname(logFilePath)
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true })
}

// Main application logger
export const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'accelerate-content' },
  transports: [
    // Write all logs to file
    new winston.transports.File({ 
      filename: logFilePath,
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),
    // Write errors to separate file
    new winston.transports.File({ 
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 10485760,
      maxFiles: 5
    })
  ]
})

// Audit logger for tracking admin actions
export const auditLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ 
      filename: auditLogPath,
      maxsize: 10485760,
      maxFiles: 10
    })
  ]
})

// Add console output in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }))
}

// Audit logging helper
export const logAuditEvent = (
  userId: string,
  action: string,
  resource: string,
  details?: any,
  result?: 'success' | 'failure'
) => {
  auditLogger.info({
    userId,
    action,
    resource,
    details,
    result: result || 'success',
    timestamp: new Date().toISOString(),
    ip: details?.ip,
    userAgent: details?.userAgent
  })
}

// Error tracking helper
export const logError = (
  error: Error,
  context?: {
    userId?: string
    action?: string
    metadata?: any
  }
) => {
  logger.error({
    message: error.message,
    stack: error.stack,
    ...context,
    timestamp: new Date().toISOString()
  })
  
  // Send to error tracking service in production
  if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
    // Sentry integration would go here
  }
}

// Performance logging
export const logPerformance = (
  operation: string,
  duration: number,
  metadata?: any
) => {
  logger.info({
    type: 'performance',
    operation,
    duration,
    ...metadata,
    timestamp: new Date().toISOString()
  })
}

export default logger