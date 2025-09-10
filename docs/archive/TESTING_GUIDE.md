# 🧪 Testing Guide - Accelerate Content Automation

## Quick Start

### 1. Development Setup

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your Supabase credentials

# Seed development data (creates test admin users)
npm run seed:dev
```

### 2. Test Credentials

After running `npm run seed:dev`, use these credentials:

**Development Admin Users:**
- Email: `admin@test.com` / Password: `Admin123!`
- Email: `dev@test.com` / Password: `Dev123!`

### 3. Start Development Server

```bash
npm run dev
```

Visit http://localhost:3001 and login with test credentials.

## Authentication Flow

### Public Routes (No Auth Required)
- `/login` - Login page
- `/` - Redirects to login or dashboard based on auth status

### Protected Routes (Admin Only)
- `/dashboard` - Main dashboard
- `/queue` - Content queue management
- `/settings` - Application settings
- `/admin` - Admin settings
- `/analytics` - Analytics dashboard
- `/sources` - Data sources
- `/test` - System test page

## Testing Best Practices

### 1. Local Development Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

### 2. Manual Testing Checklist

#### Authentication
- [ ] Can access login page without authentication
- [ ] Login redirects to dashboard on success
- [ ] Invalid credentials show error message
- [ ] Logout clears session and redirects to login
- [ ] Protected routes redirect to login when not authenticated
- [ ] Admin-only routes show access denied for non-admin users

#### Navigation
- [ ] All sidebar links work correctly
- [ ] Browser back/forward buttons work
- [ ] Direct URL access works for all routes
- [ ] 404 pages redirect to login

#### Error Handling
- [ ] 401 errors redirect to login
- [ ] 403 errors show access denied
- [ ] Network errors show appropriate messages
- [ ] Form validation errors display correctly

### 3. Production Testing

```bash
# Build for production
npm run build

# Test production build locally
npm run preview

# Deploy to staging
vercel

# Deploy to production
vercel --prod
```

## Environment-Specific Configuration

### Development (.env)
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
NODE_ENV=development
```

### Production (Vercel Environment Variables)
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
NODE_ENV=production
```

## Troubleshooting

### Common Issues

#### 1. "401 Unauthorized" on all pages
**Solution**: The app now properly handles this. Login page is public, and auth is only required for admin routes.

#### 2. "Cannot read properties of undefined"
**Cause**: Missing environment variables
**Solution**: Ensure `.env` file exists with required variables

#### 3. "Network Error" 
**Cause**: API not running or CORS issues
**Solution**: Check that backend is running and CORS is configured

#### 4. Test failures
**Cause**: Mocks not properly configured
**Solution**: Check `jest.setup.ts` is loaded in Jest config

## Admin User Management

### Create Admin User Manually

```bash
# Interactive prompt
npm run admin:create-user

# For production with secure password
NODE_ENV=production npm run seed:prod
```

### Reset Admin Password

1. Access Supabase dashboard
2. Navigate to Authentication > Users
3. Select user and reset password
4. Or use Supabase CLI:

```bash
supabase auth admin update-user \
  --email admin@test.com \
  --password NewPassword123!
```

## Testing Different Scenarios

### 1. Fresh Install Test
```bash
rm -rf node_modules package-lock.json
npm install
npm run seed:dev
npm run dev
```

### 2. Production Simulation
```bash
NODE_ENV=production npm run build
NODE_ENV=production npm run preview
```

### 3. Database Reset
```bash
# Clear all data (be careful!)
supabase db reset

# Re-seed
npm run seed:dev
```

## Continuous Testing

### Pre-commit Checks
```bash
# Run before committing
npm run typecheck
npm test
npm run build
```

### GitHub Actions (Recommended)
Create `.github/workflows/test.yml`:

```yaml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test
      - run: npm run build
```

## Security Testing

### 1. Authentication Security
- Test with expired tokens
- Test with invalid tokens
- Test session timeout
- Test concurrent sessions

### 2. Authorization Security
- Test accessing admin routes as non-admin
- Test API endpoints with different roles
- Test data access permissions

### 3. Input Validation
- Test SQL injection attempts
- Test XSS attempts
- Test file upload restrictions

## Performance Testing

### 1. Build Size
```bash
npm run build
# Check dist folder size
# Should be < 2MB for optimal performance
```

### 2. Load Time
- First contentful paint < 1.5s
- Time to interactive < 3s
- Lighthouse score > 90

### 3. API Response Time
- Login < 500ms
- Dashboard load < 1s
- Data fetches < 2s

## Support

For issues or questions:
1. Check error logs in browser console
2. Check network tab for failed requests
3. Review server logs if available
4. Create an issue on GitHub with reproduction steps