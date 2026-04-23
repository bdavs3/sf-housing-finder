ALTER TABLE listings ADD COLUMN move_in_date text;
ALTER TABLE listings ADD COLUMN favorited boolean not null default false;