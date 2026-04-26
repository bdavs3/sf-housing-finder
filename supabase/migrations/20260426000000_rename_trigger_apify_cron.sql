-- Rename trigger-apify route to trigger-groups
select cron.unschedule('daily-scrape');

select cron.schedule(
  'daily-groups',
  '0 6 * * *',
  $$
    select net.http_post(
      url := 'https://sf-housing-finder.vercel.app/api/trigger-groups',
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
