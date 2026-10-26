-- Migration 004: Scheduled daily channel sync cron job
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove existing job if present
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-channel-sync') THEN
    PERFORM cron.unschedule('daily-channel-sync');
  END IF;
END $$;

-- Schedule daily sync at 03:00 UTC
SELECT cron.schedule(
  'daily-channel-sync',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://liortxbcrqjqborqqchh.supabase.co/functions/v1/sync-all-channels',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxpb3J0eGJjcnFqcWJvcnFxY2hoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDkzMzU0NywiZXhwIjoyMTA2NTA5NTQ3fQ.KYjTQkvu6MDbYyiXLoJgiNEj8QUURGq6EmR40ilGxLg", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
