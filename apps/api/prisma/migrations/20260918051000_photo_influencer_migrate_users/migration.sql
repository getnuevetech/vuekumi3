-- Photographers with creatorKind photo_influencer become their own account type.
UPDATE "User" AS u
SET "accountType" = 'photo_influencer'
FROM "ContributorProfile" AS p
WHERE p."userId" = u.id
  AND u."accountType" = 'photographer'
  AND p."creatorKind" = 'photo_influencer';
