-- Rooms carry a display name ("North Stand Lads") chosen at creation.
alter table rooms add column if not exists name text;
