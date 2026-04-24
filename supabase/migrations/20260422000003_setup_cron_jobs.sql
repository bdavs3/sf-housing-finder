-- daily-scrape: 6am MDT (UTC-6) = 12pm UTC
select cron.schedule(
  'daily-scrape',
  '0 12 * * *',
  $$
    select net.http_post(
      url := 'https://sf-housing-finder.vercel.app/api/trigger-apify',
      headers := '{"Content-Type": "application/json"}'::jsonb,
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
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
    )
  $$
);
