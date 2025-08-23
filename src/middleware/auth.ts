import { Request, Response, NextFunction } from 'express'
import { supabase } from '../lib/supabase'

// Simple API key authentication for MVP
const API_KEYS = new Set([
  process.env.API_KEY || 'development-key-change-this'
])

export const requireApiKey = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] as string
  
  if (!apiKey || !API_KEYS.has(apiKey)) {
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Valid API key required' 
    })
  }
  
  next()
}

// Supabase JWT authentication
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' })
    }
    
    const { data: { user }, error } = await supabase.auth.getUser(token)
    
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' })
    }
    
    // Add user to request
    (req as any).user = user
    next()
  } catch (error) {
    res.status(500).json({ error: 'Authentication failed' })
  }
}

// Rate limiting tracker (basic implementation)
const requestCounts = new Map<string, { count: number; resetTime: number }>()

export const rateLimit = (maxRequests = 100, windowMs = 60000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || 'unknown'
    const now = Date.now()
    
    const userRequests = requestCounts.get(ip) || { count: 0, resetTime: now + windowMs }
    
    if (now > userRequests.resetTime) {
      userRequests.count = 0
      userRequests.resetTime = now + windowMs
    }
    
    userRequests.count++
    requestCounts.set(ip, userRequests)
    
    if (userRequests.count > maxRequests) {
      return res.status(429).json({ 
        error: 'Too many requests', 
        retryAfter: Math.ceil((userRequests.resetTime - now) / 1000) 
      })
    }
    
    next()
  }
}