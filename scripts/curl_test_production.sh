#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# SRE Production URL Curl Benchmark (10 iterations)
# Tests status codes, latency, and response headers for /health
# ──────────────────────────────────────────────────────────────────────────────

TARGET_URL="${1:-https://jrujutv.onrender.com/health}"
ITERATIONS=10

echo "================================================================"
echo "🎯 Probing Target URL: ${TARGET_URL}"
echo "   Iterations: ${ITERATIONS}"
echo "================================================================"

TOTAL_TIME=0
SUCCESS_COUNT=0
FAIL_COUNT=0
MIN_TIME=999999
MAX_TIME=0

for i in $(seq 1 ${ITERATIONS}); do
  START=$(date +%s%3N 2>/dev/null || python -c 'import time; print(int(time.time()*1000))' 2>/dev/null || node -e 'console.log(Date.now())')
  
  # Perform request
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 "${TARGET_URL}")
  
  END=$(date +%s%3N 2>/dev/null || python -c 'import time; print(int(time.time()*1000))' 2>/dev/null || node -e 'console.log(Date.now())')
  DURATION=$((END - START))
  
  if [ "$HTTP_CODE" -eq 200 ]; then
    STATUS_ICON="✅"
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
  else
    STATUS_ICON="❌"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi

  echo "  [${i}/${ITERATIONS}] ${STATUS_ICON} HTTP ${HTTP_CODE} in ${DURATION}ms"
  
  TOTAL_TIME=$((TOTAL_TIME + DURATION))
  
  if [ "$DURATION" -lt "$MIN_TIME" ]; then
    MIN_TIME=$DURATION
  fi
  if [ "$DURATION" -gt "$MAX_TIME" ]; then
    MAX_TIME=$DURATION
  fi
  
  sleep 1
done

AVG_TIME=$((TOTAL_TIME / ITERATIONS))

echo "================================================================"
echo "📊 Benchmark Summary:"
echo "   Success: ${SUCCESS_COUNT}/${ITERATIONS}"
echo "   Failures: ${FAIL_COUNT}/${ITERATIONS}"
echo "   Min Latency: ${MIN_TIME}ms"
echo "   Max Latency: ${MAX_TIME}ms"
echo "   Avg Latency: ${AVG_TIME}ms"
echo "================================================================"
