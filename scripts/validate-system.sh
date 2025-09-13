#!/bin/bash
# System Validation Script

echo "=== ACCELERATE SYSTEM VALIDATION ==="
echo ""

echo "📍 Directory Check:"
pwd
echo ""

echo "🔧 TypeScript Compilation:"
npx tsc --noEmit 2>&1 | grep -c "error TS" | xargs -I {} echo "  Errors: {}"
echo ""

echo "🧪 Test Status:"
npm test 2>&1 | grep -E "Test Suites:" | head -1
echo ""

echo "🔒 Security Audit:"
npm audit --audit-level=high 2>&1 | grep "vulnerabilities" | tail -1
echo ""

echo "📦 Build Status:"
npm run build 2>&1 | grep -q "built in" && echo "  ✅ Build successful" || echo "  ❌ Build failed"
echo ""

echo "🗄️ Database Check:"
npx tsx -e "
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://eqpfvmwmdtsgddpsodsr.supabase.co',
  process.env.SUPABASE_ANON_KEY || ''
);
async function check() {
  const { count } = await supabase.from('queue_projects').select('*', { count: 'exact', head: true });
  console.log('  Projects in queue:', count || 0);
}
check().catch(() => console.log('  ❌ Database connection failed'));
" 2>/dev/null
echo ""

echo "✅ Validation Complete"
