-- Profile names are stored as first and last name. `name` stays the display string.
ALTER TABLE "User" ADD COLUMN "firstName" TEXT;
ALTER TABLE "User" ADD COLUMN "lastName" TEXT;

UPDATE "User" AS u
SET
  "firstName" = s.first_name,
  "lastName" = s.last_name
FROM (
  SELECT
    id,
    split_part(clean, ' ', 1) AS first_name,
    CASE
      WHEN position(' ' IN clean) = 0 THEN ''
      ELSE btrim(substring(clean FROM position(' ' IN clean) + 1))
    END AS last_name
  FROM (
    SELECT id, btrim(regexp_replace("name", '\s+', ' ', 'g')) AS clean
    FROM "User"
  ) cleaned
) AS s
WHERE u.id = s.id
  AND u."firstName" IS NULL;
