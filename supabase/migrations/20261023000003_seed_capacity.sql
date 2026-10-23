-- Starting capacity (lib/config.ts → CAPACITY_DEFAULTS); the owner changes it on the dashboard.
-- Cleaning: visits per arrival window — 2/2/1 Monday–Friday, 1/1/0 Saturday, Sunday closed.
insert into capacity (kind, weekday, "window", slots)
select 'cleaning', d, w.win, case
  when d = 0 then 0
  when d = 6 then (array[1, 1, 0])[w.i]
  else (array[2, 2, 1])[w.i]
end
from generate_series(0, 6) as d
cross join (values (1, 'morning'::arrival_window), (2, 'midday'), (3, 'afternoon')) as w(i, win);

-- Yards per route day.
insert into capacity (kind, weekday, slots) values
  ('yard', 1, 12), ('yard', 2, 12), ('yard', 3, 10), ('yard', 4, 12), ('yard', 5, 8);
