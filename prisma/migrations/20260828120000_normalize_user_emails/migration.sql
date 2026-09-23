-- Canonicalise stored addresses to lower case.
--
-- Better Auth looks a user up with `lower(email)`, and SQLite's `=` is
-- case-sensitive, so any row stored with capitals was unreachable: requesting a
-- code worked, entering it consumed the verification row, and the sign-in then
-- failed as "Invalid OTP" because the account could not be found. The routes
-- now normalise on the way in (see `server/utils/normalizeEmail.ts`); this
-- repairs the rows written before they did.
--
-- The NOT EXISTS guard skips the case where two rows differ only by
-- capitalisation — `users.email` is UNIQUE, so folding them would abort the
-- whole migration. Those pairs are left alone to be merged by hand.
UPDATE "users"
SET "email" = lower("email")
WHERE "email" <> lower("email")
  AND NOT EXISTS (
    SELECT 1 FROM "users" AS "other"
    WHERE "other"."id" <> "users"."id"
      AND "other"."email" = lower("users"."email")
  );
