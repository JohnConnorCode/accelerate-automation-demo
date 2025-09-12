#!/bin/bash

# ACCELERATE Content Automation - System Validation Script
# Purpose: Comprehensive validation of system health and functionality
# Usage: bash scripts/validate-system.sh

set -e  # Exit on any error

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "================================================"
echo "ACCELERATE System Validation - $(date)"
echo "================================================"
echo ""

# Track overall status
FAILED_CHECKS=0
PASSED_CHECKS=0

# Function to check a condition
check() {
    local description="$1"
    local command="$2"
    
    echo -n "Checking: $description... "
    
    if eval "$command" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PASS${NC}"
        ((PASSED_CHECKS++))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC}"
        ((FAILED_CHECKS++))
        return 1
    fi
}

# Function to count occurrences
count_check() {
    local description="$1"
    local command="$2"
    local max_allowed="$3"
    
    echo -n "Checking: $description... "
    
    local count=$(eval "$command" 2>/dev/null || echo "999")
    
    if [ "$count" -le "$max_allowed" ]; then
        echo -e "${GREEN}✓ PASS${NC} (found: $count, max: $max_allowed)"
        ((PASSED_CHECKS++))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (found: $count, max: $max_allowed)"
        ((FAILED_CHECKS++))
        return 1
    fi
}

echo "=== PHASE 1: CODE QUALITY ==="
echo ""

# Check for Math.random() usage (excluding test and archive files)
count_check "No Math.random() in source" \
    "grep -r 'Math\.random' src --include='*.ts' --include='*.tsx' | grep -v test | grep -v spec | grep -v archive | wc -l" \
    0

# Check TypeScript compilation
check "TypeScript compiles" "npm run build"

# Check for TODO/FIXME markers
count_check "Minimal TODO/FIXME markers" \
    "grep -r 'TODO\|FIXME' src --include='*.ts' --include='*.tsx' | wc -l" \
    10

echo ""
echo "=== PHASE 2: PROCESS HEALTH ==="
echo ""

# Check for zombie processes
count_check "No zombie Node processes" \
    "ps aux | grep -E 'node|tsx|npm' | grep accelerate | grep -v grep | wc -l" \
    5

# Check port availability
check "Port 3000 available or owned by us" \
    "! lsof -ti:3000 > /dev/null || lsof -i:3000 | grep -q node"

check "Port 3002 available or owned by us" \
    "! lsof -ti:3002 > /dev/null || lsof -i:3002 | grep -q node"

echo ""
echo "=== PHASE 3: DEPENDENCIES ==="
echo ""

# Check for required dependencies
check "Jest installed" "npm list @jest/globals"
check "TypeScript installed" "npm list typescript"
check "Supabase client installed" "npm list @supabase/supabase-js"

echo ""
echo "=== PHASE 4: TEST SUITE ==="
echo ""

# Run tests and capture results
echo "Running test suite..."
if npm test 2>&1 | tee /tmp/test-output.log | grep -q "PASS"; then
    TESTS_PASSED=$(grep -o "Tests:.*passed" /tmp/test-output.log | grep -o "[0-9]* passed" | grep -o "[0-9]*" | tail -1)
    TESTS_FAILED=$(grep -o "Tests:.*failed" /tmp/test-output.log | grep -o "[0-9]* failed" | grep -o "[0-9]*" | tail -1)
    
    if [ -z "$TESTS_FAILED" ] || [ "$TESTS_FAILED" -eq 0 ]; then
        echo -e "${GREEN}✓ All tests passing${NC} ($TESTS_PASSED tests)"
        ((PASSED_CHECKS++))
    else
        echo -e "${YELLOW}⚠ Some tests failing${NC} ($TESTS_FAILED failed, $TESTS_PASSED passed)"
        ((FAILED_CHECKS++))
    fi
else
    echo -e "${RED}✗ Test suite failed to run${NC}"
    ((FAILED_CHECKS++))
fi

echo ""
echo "=== PHASE 5: DATABASE VALIDATION ==="
echo ""

# Check for database operations (want at least 5)
INSERTS=$(grep -r 'supabase.*insert\|supabase.*upsert' src --include='*.ts' | wc -l)
echo -n "Checking: Database operations exist... "
if [ "$INSERTS" -ge 5 ]; then
    echo -e "${GREEN}✓ PASS${NC} (found: $INSERTS operations)"
    ((PASSED_CHECKS++))
else
    echo -e "${RED}✗ FAIL${NC} (found: $INSERTS, need at least 5)"
    ((FAILED_CHECKS++))
fi

count_check "No direct SQL injection risks" \
    "grep -r 'supabase.*raw' src --include='*.ts' | wc -l" \
    0

echo ""
echo "=== PHASE 6: API ENDPOINTS ==="
echo ""

# Try to start server and check health
echo "Starting server for health check..."
timeout 10 npm run dev > /dev/null 2>&1 &
SERVER_PID=$!
sleep 5

if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ API server responds${NC}"
    ((PASSED_CHECKS++))
else
    echo -e "${RED}✗ API server not responding${NC}"
    ((FAILED_CHECKS++))
fi

# Clean up server
kill $SERVER_PID 2>/dev/null || true

echo ""
echo "=== PHASE 7: REAL DATA SOURCES ==="
echo ""

# Check for real API implementations
check "HackerNews source exists" "grep -q 'news.ycombinator.com' src/core/unified-orchestrator.ts"
check "GitHub source exists" "grep -q 'api.github.com' src/core/unified-orchestrator.ts"
check "Dev.to source exists" "grep -q 'dev.to/api' src/core/unified-orchestrator.ts"

echo ""
echo "================================================"
echo "VALIDATION SUMMARY"
echo "================================================"
echo ""

TOTAL_CHECKS=$((PASSED_CHECKS + FAILED_CHECKS))
SUCCESS_RATE=$((PASSED_CHECKS * 100 / TOTAL_CHECKS))

echo "Passed: $PASSED_CHECKS / $TOTAL_CHECKS checks"
echo "Failed: $FAILED_CHECKS / $TOTAL_CHECKS checks"
echo "Success Rate: $SUCCESS_RATE%"
echo ""

if [ $FAILED_CHECKS -eq 0 ]; then
    echo -e "${GREEN}✅ SYSTEM VALIDATED - All checks passed!${NC}"
    exit 0
elif [ $SUCCESS_RATE -ge 80 ]; then
    echo -e "${YELLOW}⚠️  SYSTEM PARTIALLY VALIDATED - $SUCCESS_RATE% passing${NC}"
    echo "Review failed checks and fix before production deployment"
    exit 1
else
    echo -e "${RED}❌ SYSTEM VALIDATION FAILED - Only $SUCCESS_RATE% passing${NC}"
    echo "Critical issues detected. Do not deploy to production."
    exit 2
fi