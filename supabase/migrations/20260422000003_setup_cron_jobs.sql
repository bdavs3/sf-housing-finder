-- daily-scrape: 6am MDT (UTC-6) = 12pm UTC
select cron.schedule(
  'daily-scrape',
  '0 12 * * *',
  $$
    select net.http_post(
      url := 'https://sf-housing-finder.vercel.app/api/trigger-apify',
      headers := json_build_object(
        'Content-Type', 'application/json',
        'x-vercel-protection-bypass', (select decrypted_secret from vault.decrypted_secrets where name = 'VERCEL_AUTOMATION_BYPASS_SECRET')
      )::jsonb,
      body := '{}'::jsonb
    )
  $$
);

-- score-listings: every 5 minutes
select cron.schedule(
  'score-listings',
  '*/5 * * * *',
  $$
    select net.http_post(
      url := 'https://sf-housing-finder.vercel.app/api/score',
      headers := json_build_object(
        'Content-Type', 'application/json',
        'x-vercel-protection-bypass', (select decrypted_secret from vault.decrypted_secrets where name = 'VERCEL_AUTOMATION_BYPASS_SECRET')
      )::jsonb,
      body := '{}'::jsonb
    )
  $$
);
