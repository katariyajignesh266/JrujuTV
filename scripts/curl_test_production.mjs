#!/usr/bin/env node
/**
 * Cross-platform Production Health Benchmark (10 iterations)
 * Can be run with: node scripts/curl_test_production.mjs [url]
 */

import { performance } from 'node:perf_hooks';

const targetUrl = process.argv[2] || 'https://jrujutv.onrender.com/health';
const iterations = 10;

console.log('================================================================');
console.log(`🎯 Probing Target URL: ${targetUrl}`);
console.log(`   Iterations: ${iterations}`);
console.log('================================================================');

let totalTime = 0;
let successCount = 0;
let failCount = 0;
let minTime = Infinity;
let maxTime = 0;
const results = [];

for (let i = 1; i <= iterations; i++) {
  const start = performance.now();
  let statusCode = 0;
  let ok = false;
  let errorMsg = '';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(targetUrl, {
      method: 'GET',
      headers: { 'User-Agent': 'JruJuTV-SRE-Benchmark/1.0' },
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeout);
    statusCode = res.status;
    ok = res.ok;
  } catch (err) {
    errorMsg = err.message;
  }

  const duration = Math.round(performance.now() - start);
  totalTime += duration;
  if (duration < minTime) minTime = duration;
  if (duration > maxTime) maxTime = duration;

  if (ok && statusCode === 200) {
    successCount++;
    console.log(`  [${i}/${iterations}] ✅ HTTP ${statusCode} in ${duration}ms`);
  } else {
    failCount++;
    console.log(`  [${i}/${iterations}] ❌ HTTP ${statusCode || 'ERR'} (${errorMsg || 'Non-200'}) in ${duration}ms`);
  }

  results.push({ iteration: i, status: statusCode, duration, ok });

  if (i < iterations) {
    await new Promise((r) => setTimeout(r, 1000));
  }
}

const avgTime = Math.round(totalTime / iterations);

console.log('================================================================');
console.log('📊 Benchmark Summary:');
console.log(`   Success: ${successCount}/${iterations} (${(successCount / iterations) * 100}%)`);
console.log(`   Failures: ${failCount}/${iterations}`);
console.log(`   Min Latency: ${minTime === Infinity ? 0 : minTime}ms`);
console.log(`   Max Latency: ${maxTime}ms`);
console.log(`   Avg Latency: ${avgTime}ms`);
console.log('================================================================');
