-- Document input precision only: retain the existing minor-unit scale.
-- EUR 12.345 is 1234.5 minor units; TND 12.345 remains 12345.
-- Totals and payments remain integer minor units. Existing values are unchanged.
-- Prerequisite: deploy the NUMERIC-compatible adapter to every app instance first.
-- Keep three-decimal entry disabled until this migration passes integrity checks.
-- Require a complete restore-verified backup and a rehearsed rollback. Safe to rerun.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
SET LOCAL idle_in_transaction_session_timeout = '60s';
LOCK TABLE public."Invoice", public."InvoiceLine", public."Quote", public."QuoteLine"
  IN ACCESS EXCLUSIVE MODE;
ALTER TABLE public."InvoiceLine"
  ALTER COLUMN "unitPriceHTCents" TYPE numeric(14,3) USING "unitPriceHTCents"::numeric,
  ALTER COLUMN "discountAmountCents" TYPE numeric(14,3) USING "discountAmountCents"::numeric;
ALTER TABLE public."QuoteLine"
  ALTER COLUMN "unitPriceHTCents" TYPE numeric(14,3) USING "unitPriceHTCents"::numeric,
  ALTER COLUMN "discountAmountCents" TYPE numeric(14,3) USING "discountAmountCents"::numeric;
ALTER TABLE public."Invoice"
  ALTER COLUMN "globalDiscountAmountCents" TYPE numeric(14,3) USING "globalDiscountAmountCents"::numeric;
ALTER TABLE public."Quote"
  ALTER COLUMN "globalDiscountAmountCents" TYPE numeric(14,3) USING "globalDiscountAmountCents"::numeric;
-- Percentage columns already use double precision and need no conversion.
-- Precision/range validation is enforced by the shared document input schemas.
COMMIT;
