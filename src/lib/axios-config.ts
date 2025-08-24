import axios from 'axios'
import { supabase } from './supabase'

// Create axios instance with defaults
const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Request interceptor to add auth token
axiosInstance.interceptors.request.use(
  async (config) => {
    const { data: { session } } = await supabase.auth.getSession()
    
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`
    }
    
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor for global error handling
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    
    // Handle 401 errors
    if (error.response?.status === 401) {
      // Don't redirect if we're already on the login page
      if (!window.location.pathname.includes('/login')) {
        // Try to refresh the session
        const { data: { session }, error: refreshError } = await supabase.auth.refreshSession()
        
        if (!refreshError && session) {
          // Retry the original request with new token
          originalRequest.headers.Authorization = `Bearer ${session.access_token}`
          return axiosInstance(originalRequest)
        } else {
          // Session refresh failed, redirect to login
          await supabase.auth.signOut()
          window.location.href = '/login'
        }
      }
    }
    
    // Handle other errors
    if (error.response?.status === 403) {
      console.error('Access denied - insufficient permissions')
    }
    
    if (error.response?.status === 500) {
      console.error('Server error - please try again later')
    }
    
    return Promise.reject(error)
  }
)

export default axiosInstance