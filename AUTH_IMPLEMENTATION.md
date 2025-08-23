# 🔐 Authentication Implementation Guide

## Overview
This app now has **admin-only authentication** using Supabase Auth with Row Level Security (RLS).

## ✅ What's Implemented

### 1. Database Security
- ✅ `is_admin` column added to profiles table
- ✅ RLS policies restrict content_queue to admins only
- ✅ All content tables protected with admin-only policies

### 2. Frontend Authentication
- ✅ Login page at `/login`
- ✅ Protected routes requiring admin access
- ✅ Auth context with user state management
- ✅ Sign out functionality
- ✅ Admin status verification

### 3. API Security (Partial)
- ⚠️ Basic rate limiting implemented
- ⚠️ CORS configured for localhost only
- ❌ JWT validation not fully implemented in API

## 🚀 How to Set Up Admin Users

### Option 1: Use the Create Admin Script
```bash
# Get your Supabase service key from:
# https://app.supabase.com/project/eqpfvmwmdtsgddpsodsr/settings/api

SUPABASE_SERVICE_KEY=your-service-key npx tsx scripts/create-admin.ts
```

### Option 2: Manual Setup via Supabase Dashboard

1. Go to Authentication → Users in Supabase
2. Click "Invite User"
3. Enter email and they'll get a signup link
4. After they sign up, run this SQL:
```sql
UPDATE profiles 
SET is_admin = true 
WHERE email = 'admin@example.com';
```

### Option 3: Self-Registration + Manual Promotion

1. User signs up at `/login` page
2. Admin runs SQL to promote them:
```sql
UPDATE profiles 
SET is_admin = true 
WHERE email = 'user@example.com';
```

## 🔑 How Authentication Works

### Login Flow:
1. User enters email/password at `/login`
2. Supabase Auth validates credentials
3. App checks if user has `is_admin = true` in profiles
4. If admin, grants access to dashboard
5. If not admin, shows "Access Denied"

### Protected Routes:
```typescript
// All routes under "/" require admin access
<ProtectedRoute adminOnly={true}>
  <Layout />
</ProtectedRoute>
```

### RLS Policies:
```sql
-- Only admins can access content_queue
CREATE POLICY "Admins can read content_queue" ON content_queue
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.is_admin = true
  )
);
```

## 🔴 Security Status

### ✅ Working:
- Frontend authentication
- Login/logout flow
- Admin verification
- RLS database policies
- Protected routes

### ⚠️ Partial:
- API endpoints have basic protection
- Rate limiting is basic
- CORS needs production config

### ❌ Not Implemented:
- JWT validation in Express API
- Service-to-service auth
- Session management
- Password reset flow
- 2FA

## 📝 Testing Authentication

### 1. Create Test Admin:
```bash
# Using the script
SUPABASE_SERVICE_KEY=your-key npx tsx scripts/create-admin.ts

# Enter:
# Email: test@example.com
# Password: test123
# Name: Test Admin
```

### 2. Test Login:
1. Go to http://localhost:3002/login
2. Enter admin credentials
3. Should redirect to dashboard

### 3. Test Protection:
1. Open incognito window
2. Try to access http://localhost:3002/dashboard
3. Should redirect to login

### 4. Test Non-Admin:
1. Sign up with new email
2. Try to access dashboard
3. Should see "Access Denied"

## 🛠️ Troubleshooting

### "Access Denied" for Admin User:
```sql
-- Check if user is marked as admin
SELECT id, email, is_admin 
FROM profiles 
WHERE email = 'your-email@example.com';

-- Fix if needed
UPDATE profiles 
SET is_admin = true 
WHERE email = 'your-email@example.com';
```

### Can't Login:
1. Check Supabase project is running
2. Verify SUPABASE_URL and SUPABASE_ANON_KEY in code
3. Check browser console for errors

### RLS Blocking Everything:
```sql
-- Temporarily check if RLS is the issue
ALTER TABLE content_queue DISABLE ROW LEVEL SECURITY;
-- Test your app
-- Re-enable when done
ALTER TABLE content_queue ENABLE ROW LEVEL SECURITY;
```

## 🚨 Production Checklist

Before deploying to production:

- [ ] Change CORS origin from localhost
- [ ] Use environment variables for all keys
- [ ] Implement JWT validation in API
- [ ] Add password reset flow
- [ ] Add email verification
- [ ] Implement session timeout
- [ ] Add audit logging
- [ ] Enable 2FA option
- [ ] Rate limit by user, not just IP
- [ ] Add CAPTCHA to login

## 🔒 Environment Variables Needed

```env
# .env.production
VITE_SUPABASE_URL=https://eqpfvmwmdtsgddpsodsr.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
JWT_SECRET=your-jwt-secret
API_KEY=your-api-key
```

## 📚 Key Files

- `/src/contexts/AuthContext.tsx` - Auth state management
- `/src/pages/Login.tsx` - Login UI
- `/src/components/ProtectedRoute.tsx` - Route protection
- `/src/middleware/auth.ts` - API authentication
- `/scripts/create-admin.ts` - Admin creation script

## 🎯 Next Steps

1. **Complete API Security**: Add proper JWT validation to all API endpoints
2. **Add Password Reset**: Implement forgot password flow
3. **Audit Logging**: Track all admin actions
4. **Session Management**: Add timeout and refresh
5. **Production Config**: Environment-specific settings