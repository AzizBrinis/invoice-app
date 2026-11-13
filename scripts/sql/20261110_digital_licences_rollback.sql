-- Rollback for 20261110_digital_licences.sql.
-- WARNING: this permanently deletes the encrypted licence-code inventory and the
-- licence history. Export or back up the tables first if the codes must be kept.
-- Disable the licence API first (unset DIGITAL_LICENCE_API_KEYS), then run.

BEGIN;

SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';

DROP TABLE IF EXISTS "DigitalLicenceEvent";
DROP TABLE IF EXISTS "DigitalLicenceCode";
DROP TABLE IF EXISTS "DigitalLicenceOrder";

COMMIT;
