-- Date-only columns written before the app parsed date-only form values in the
-- org's timezone: hour-log dates first, campaign dates at the bottom.
--
-- `<input type="date">` sends "2026-08-12" and the handlers ran it through
-- `new Date(...)`, which reads a bare date as midnight *UTC*. Central is behind
-- UTC, so that instant is 6pm or 7pm on the 11th here — and the reports bucket
-- by day, week, month and year in Central, so those logs were counted against
-- the day before the one the volunteer picked, and against the previous month
-- whenever they fell on a 1st.
--
-- The write paths now store midnight Central (`parseZonedDate`). This moves the
-- rows already written: only those whose stored value is exactly midnight UTC,
-- which is the fingerprint of that bug — rows carrying a real time of day came
-- from the seed or from an event, and are left alone.
--
-- +6 hours is CST. During CDT the correct offset is +5, which would land on
-- midnight rather than 1am, but both instants read as the same calendar date in
-- Central, and the calendar date is the whole content of this column. Picking
-- one constant keeps this as plain SQL: SQLite has no timezone database and
-- cannot work out which side of a DST switch a given row falls on.
UPDATE "volunteer_hour_logs"
SET "date" = strftime('%Y-%m-%dT%H:%M:%f', "date", '+6 hours') || '+00:00'
WHERE typeof("date") = 'text'
  AND "date" LIKE '%T00:00:00.000+00:00';

-- Same rows, had they been stored as epoch milliseconds (older Prisma clients
-- did): midnight UTC is an exact multiple of a day.
UPDATE "volunteer_hour_logs"
SET "date" = "date" + 21600000
WHERE typeof("date") = 'integer'
  AND "date" % 86400000 = 0;

-- The same fix for campaign dates, written by the same kind of handler from the
-- same kind of `<input type="date">`. The admin table used to add a day back on
-- when displaying them, which rolled 31 Jan over into "01/32/26"; that
-- compensation is gone, so these rows have to carry the right instant.
UPDATE "Donation"
SET "startDate" = strftime('%Y-%m-%dT%H:%M:%f', "startDate", '+6 hours') || '+00:00'
WHERE typeof("startDate") = 'text'
  AND "startDate" LIKE '%T00:00:00.000+00:00';

UPDATE "Donation"
SET "endDate" = strftime('%Y-%m-%dT%H:%M:%f', "endDate", '+6 hours') || '+00:00'
WHERE typeof("endDate") = 'text'
  AND "endDate" LIKE '%T00:00:00.000+00:00';

UPDATE "Donation"
SET "startDate" = "startDate" + 21600000
WHERE typeof("startDate") = 'integer'
  AND "startDate" % 86400000 = 0;

UPDATE "Donation"
SET "endDate" = "endDate" + 21600000
WHERE typeof("endDate") = 'integer'
  AND "endDate" % 86400000 = 0;
