create table scrape_status (
  id int primary key,
  status text not null default 'idle' check (status in ('idle', 'scraping')),
  run_id text,
  post_count int,
  started_at timestamptz
);

insert into scrape_status (id, status) values (1, 'idle');
