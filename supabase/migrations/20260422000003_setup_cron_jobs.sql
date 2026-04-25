-- daily-scrape: midnight MDT (UTC-6) = 6am UTC
select cron.schedule(
  'daily-scrape',
  '0 6 * * *',
  $$
    select net.http_post(
      url := 'https://sf-housing-finder.vercel.app/api/trigger-apify',
      headers := json_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Basic ' || encode(convert_to(
          (select decrypted_secret from vault.decrypted_secrets where name = 'SITE_USER') || ':' ||
          (select decrypted_secret from vault.decrypted_secrets where name = 'SITE_PASS'),
          'utf8'
        ), 'base64')
      )::jsonb,
      body := '{}'::jsonb
    )
  $$
);

-- daily-marketplace: midnight MDT (UTC-6) = 6am UTC
select cron.schedule(
  'daily-marketplace',
  '0 6 * * *',
  $$
    select net.http_post(
      url := 'https://sf-housing-finder.vercel.app/api/trigger-marketplace',
      headers := json_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Basic ' || encode(convert_to(
          (select decrypted_secret from vault.decrypted_secrets where name = 'SITE_USER') || ':' ||
          (select decrypted_secret from vault.decrypted_secrets where name = 'SITE_PASS'),
          'utf8'
        ), 'base64')
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
        'Authorization', 'Basic ' || encode(convert_to(
          (select decrypted_secret from vault.decrypted_secrets where name = 'SITE_USER') || ':' ||
          (select decrypted_secret from vault.decrypted_secrets where name = 'SITE_PASS'),
          'utf8'
        ), 'base64')
      )::jsonb,
      body := '{}'::jsonb
    )
  $$
);
