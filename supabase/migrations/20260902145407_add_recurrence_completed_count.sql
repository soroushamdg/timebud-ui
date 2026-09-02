-- Tracks how many occurrences of a recurring task have actually been completed, so
-- `recurrence_end_after` ("end after N times") can be enforced — previously stored on
-- the task but never read by the due-date advancement logic, so it silently did nothing.
alter table tasks add column recurrence_completed_count integer not null default 0;
