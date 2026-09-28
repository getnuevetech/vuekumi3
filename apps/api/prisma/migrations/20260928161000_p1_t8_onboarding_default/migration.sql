-- P1-T8: flip default contributor onboarding to ACTIVE-country requirement.
-- Legacy africa_list remains available as an explicit admin override.

INSERT INTO "PlatformSetting" ("key", "value", "secret", "label", "group", "updatedAt")
VALUES (
  'geo.contributor_onboarding_policy',
  'africa_list_and_country_active',
  false,
  'Contributor onboarding policy (africa_list | africa_list_and_country_active)',
  'Geo / Country policy',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO UPDATE SET
  "value" = 'africa_list_and_country_active',
  "label" = 'Contributor onboarding policy (africa_list | africa_list_and_country_active)',
  "group" = 'Geo / Country policy',
  "updatedAt" = CURRENT_TIMESTAMP;
