// scripts/ingest-shorts.mjs
// Shorts V2 Ingestion Worker: Downloads YouTube Shorts, encodes to faststart H.264 MP4 + poster,
// uploads to Cloudflare R2 (S3-compatible API via native SigV4), and updates DB.

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import https from 'node:https';

const execAsync = promisify(exec);

// ─── Environment Configuration ────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const R2_ACCOUNT_ID = process.env.CLOUDFLARE_R2_ACCOUNT_ID || '';
const R2_ACCESS_KEY_ID = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '';
const R2_BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME || 'jrujutv-shorts';
const R2_PUBLIC_URL = (process.env.CLOUDFLARE_R2_PUBLIC_URL || '').replace(/\/$/, '');

// ─── AWS Signature V4 S3 Client for Cloudflare R2 ────────────────────────────
function hmac(key, string) {
  return crypto.createHmac('sha256', key).update(string).digest();
}

function hash(string) {
  return crypto.createHash('sha256').update(string).digest('hex');
}

/**
 * Upload a local file buffer to Cloudflare R2 using AWS Signature V4
 */
export async function uploadToR2(objectKey, fileBuffer, contentType) {
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error('Cloudflare R2 credentials (ACCOUNT_ID, ACCESS_KEY_ID, SECRET_ACCESS_KEY) are not configured');
  }

  const endpointHost = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const region = 'auto';
  const service = 's3';

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);

  const payloadHash = hash(fileBuffer);
  const canonicalUri = `/${R2_BUCKET_NAME}/${objectKey}`;

  const canonicalHeaders =
    `host:${endpointHost}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';

  const canonicalRequest =
    `PUT\n` +
    `${canonicalUri}\n` +
    `\n` +
    `${canonicalHeaders}\n` +
    `${signedHeaders}\n` +
    `${payloadHash}`;

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign =
    `AWS4-HMAC-SHA256\n` +
    `${amzDate}\n` +
    `${credentialScope}\n` +
    `${hash(canonicalRequest)}`;

  const kDate = hmac(`AWS4${R2_SECRET_ACCESS_KEY}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, 'aws4_request');
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  const authorizationHeader =
    `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY_ID}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return new Promise((resolve, reject) => {
    const options = {
      hostname: endpointHost,
      port: 443,
      path: canonicalUri,
      method: 'PUT',
      headers: {
        Host: endpointHost,
        'Content-Type': contentType,
        'Content-Length': fileBuffer.length,
        'x-amz-date': amzDate,
        'x-amz-content-sha256': payloadHash,
        Authorization: authorizationHeader,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const publicUrl = R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${objectKey}` : `https://${endpointHost}${canonicalUri}`;
          resolve(publicUrl);
        } else {
          reject(new Error(`R2 Upload failed with status ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(fileBuffer);
    req.end();
  });
}

// ─── Supabase REST Helper ─────────────────────────────────────────────────────
async function supabasePatch(table, matchField, matchValue, data) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${matchField}=eq.${encodeURIComponent(matchValue)}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errText = await res.text();
    console.error(`Supabase PATCH failed: ${errText}`);
  }
}

// ─── Single Short Ingestion Pipeline ──────────────────────────────────────────
export async function ingestShortVideo(video) {
  const { id, youtube_video_id } = video;
  const workDir = path.join(process.cwd(), '.tmp_shorts');
  if (!fs.existsSync(workDir)) fs.mkdirSync(workDir, { recursive: true });

  const rawFile = path.join(workDir, `${id}_raw.mp4`);
  const encodedFile = path.join(workDir, `${id}_encoded.mp4`);
  const posterFile = path.join(workDir, `${id}_poster.jpg`);

  console.log(`[Ingest] Processing Short ${youtube_video_id} (ID: ${id})...`);

  try {
    // 1. Mark as processing in DB
    await supabasePatch('videos', 'id', id, {
      media_status: 'processing',
      media_queued_at: new Date().toISOString(),
    });

    // 2. Download via yt-dlp (max 1080p, capped at 65s)
    const ytUrl = `https://www.youtube.com/shorts/${youtube_video_id}`;
    console.log(`[Ingest] Downloading ${ytUrl}...`);
    const dlCmd = `yt-dlp --format "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080]" --merge-output-format mp4 --no-playlist --socket-timeout 30 -o "${rawFile}" "${ytUrl}"`;
    await execAsync(dlCmd);

    // 3. Transcode with ffmpeg: H.264 Baseline (broadest mobile compatibility) + AAC + faststart moov atom
    console.log(`[Ingest] Transcoding with ffmpeg (-movflags +faststart)...`);
    const ffCmd = `ffmpeg -y -i "${rawFile}" -c:v libx264 -preset fast -crf 23 -profile:v baseline -level 3.1 -c:a aac -b:a 128k -ac 2 -movflags +faststart -vf "scale='min(1080,iw)':-2" -t 65 "${encodedFile}"`;
    await execAsync(ffCmd);

    // 4. Extract pristine poster frame at 1.0 second
    console.log(`[Ingest] Extracting poster frame...`);
    const posterCmd = `ffmpeg -y -ss 00:00:01.000 -i "${encodedFile}" -frames:v 1 -q:v 2 -vf "scale=720:-2" "${posterFile}"`;
    await execAsync(posterCmd);

    // 5. Read buffers & upload to R2
    console.log(`[Ingest] Uploading assets to Cloudflare R2...`);
    const videoBuffer = fs.readFileSync(encodedFile);
    const posterBuffer = fs.readFileSync(posterFile);

    const videoKey = `shorts/${id}/video.mp4`;
    const posterKey = `shorts/${id}/poster.jpg`;

    const storageUrl = await uploadToR2(videoKey, videoBuffer, 'video/mp4');
    const posterUrl = await uploadToR2(posterKey, posterBuffer, 'image/jpeg');

    // 6. Update DB record to 'ready'
    await supabasePatch('videos', 'id', id, {
      storage_url: storageUrl,
      poster_url: posterUrl,
      r2_object_key: `shorts/${id}/`,
      media_status: 'ready',
      media_error: null,
    });

    console.log(`[Ingest] ✅ Short ${youtube_video_id} successfully processed and live at ${storageUrl}`);
    return { success: true, storageUrl, posterUrl };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[Ingest] ❌ Error processing ${youtube_video_id}:`, errorMsg);

    await supabasePatch('videos', 'id', id, {
      media_status: 'error',
      media_error: errorMsg.slice(0, 500),
    });

    return { success: false, error: errorMsg };
  } finally {
    // Clean up temporary local files
    try {
      if (fs.existsSync(rawFile)) fs.unlinkSync(rawFile);
      if (fs.existsSync(encodedFile)) fs.unlinkSync(encodedFile);
      if (fs.existsSync(posterFile)) fs.unlinkSync(posterFile);
    } catch {
      // ignore cleanup errors
    }
  }
}

