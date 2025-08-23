import { Request, Response, NextFunction } from 'express'
import validator from 'validator'
import DOMPurify from 'isomorphic-dompurify'

/**
 * Sanitize and validate input data
 */
export const sanitizeInput = (data: any): any => {
  if (typeof data === 'string') {
    // Remove any HTML/script tags
    data = DOMPurify.sanitize(data, { ALLOWED_TAGS: [] })
    // Trim whitespace
    data = data.trim()
    // Escape special characters
    data = validator.escape(data)
  } else if (Array.isArray(data)) {
    data = data.map(item => sanitizeInput(item))
  } else if (data && typeof data === 'object') {
    for (const key in data) {
      data[key] = sanitizeInput(data[key])
    }
  }
  return data
}

/**
 * Validate email format
 */
export const validateEmail = (email: string): boolean => {
  return validator.isEmail(email)
}

/**
 * Validate URL format
 */
export const validateURL = (url: string): boolean => {
  return validator.isURL(url, {
    protocols: ['http', 'https'],
    require_protocol: true
  })
}

/**
 * Validate UUID format
 */
export const validateUUID = (uuid: string): boolean => {
  return validator.isUUID(uuid)
}

/**
 * Input validation middleware
 */
export const validateInput = (rules: {
  body?: any,
  query?: any,
  params?: any
}) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: string[] = []

    // Validate body
    if (rules.body) {
      for (const field in rules.body) {
        const rule = rules.body[field]
        const value = req.body[field]

        if (rule.required && !value) {
          errors.push(`${field} is required`)
        }

        if (value && rule.type) {
          switch (rule.type) {
            case 'email':
              if (!validateEmail(value)) {
                errors.push(`${field} must be a valid email`)
              }
              break
            case 'url':
              if (!validateURL(value)) {
                errors.push(`${field} must be a valid URL`)
              }
              break
            case 'uuid':
              if (!validateUUID(value)) {
                errors.push(`${field} must be a valid UUID`)
              }
              break
            case 'number':
              if (isNaN(Number(value))) {
                errors.push(`${field} must be a number`)
              }
              break
            case 'boolean':
              if (typeof value !== 'boolean') {
                errors.push(`${field} must be a boolean`)
              }
              break
            case 'array':
              if (!Array.isArray(value)) {
                errors.push(`${field} must be an array`)
              }
              break
          }
        }

        if (value && rule.min !== undefined) {
          if (typeof value === 'string' && value.length < rule.min) {
            errors.push(`${field} must be at least ${rule.min} characters`)
          }
          if (typeof value === 'number' && value < rule.min) {
            errors.push(`${field} must be at least ${rule.min}`)
          }
        }

        if (value && rule.max !== undefined) {
          if (typeof value === 'string' && value.length > rule.max) {
            errors.push(`${field} must be at most ${rule.max} characters`)
          }
          if (typeof value === 'number' && value > rule.max) {
            errors.push(`${field} must be at most ${rule.max}`)
          }
        }

        if (value && rule.pattern) {
          const regex = new RegExp(rule.pattern)
          if (!regex.test(value)) {
            errors.push(`${field} format is invalid`)
          }
        }
      }
    }

    // Similar validation for query and params...

    if (errors.length > 0) {
      return res.status(400).json({ 
        error: 'Validation failed',
        errors 
      })
    }

    // Sanitize all input
    req.body = sanitizeInput(req.body)
    req.query = sanitizeInput(req.query)
    req.params = sanitizeInput(req.params)

    next()
  }
}

/**
 * Prevent SQL injection by validating database queries
 */
export const validateDatabaseInput = (input: string): boolean => {
  // Check for common SQL injection patterns
  const sqlPatterns = [
    /(\bDROP\b|\bDELETE\b|\bINSERT\b|\bUPDATE\b|\bSELECT\b)/i,
    /(\-\-|\/\*|\*\/|xp_|sp_|0x)/i,
    /(UNION|EXEC|EXECUTE|DECLARE|CREATE|ALTER)/i
  ]

  for (const pattern of sqlPatterns) {
    if (pattern.test(input)) {
      return false
    }
  }

  return true
}

/**
 * Rate limiting per user
 */
export const userRateLimit = (maxRequests: number = 50, windowMs: number = 60000) => {
  const userRequests = new Map<string, { count: number, resetTime: number }>()

  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next()
    }

    const userId = req.user.id
    const now = Date.now()
    const userLimit = userRequests.get(userId)

    if (!userLimit || now > userLimit.resetTime) {
      userRequests.set(userId, {
        count: 1,
        resetTime: now + windowMs
      })
      return next()
    }

    if (userLimit.count >= maxRequests) {
      return res.status(429).json({
        error: 'Too many requests',
        retryAfter: Math.ceil((userLimit.resetTime - now) / 1000)
      })
    }

    userLimit.count++
    next()
  }
}