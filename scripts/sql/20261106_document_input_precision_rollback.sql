-- Rehearse on the restore-verified backup before any production migration.
-- This is an in-place, data-preserving schema rollback. It deliberately fails
-- if reverting would round any value or overflow the original integer type.
-- If this guard fails, retain NUMERIC columns and the compatible adapter.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
SET LOCAL idle_in_transaction_session_timeout = '60s';
LOCK TABLE public."Invoice", public."InvoiceLine", public."Quote", public."QuoteLine"
  IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM (
      SELECT "unitPriceHTCents" AS amount FROM public."InvoiceLine"
      UNION ALL SELECT "discountAmountCents" FROM public."InvoiceLine"
      UNION ALL SELECT "unitPriceHTCents" FROM public."QuoteLine"
      UNION ALL SELECT "discountAmountCents" FROM public."QuoteLine"
      UNION ALL SELECT "globalDiscountAmountCents" FROM public."Invoice"
      UNION ALL SELECT "globalDiscountAmountCents" FROM public."Quote"
    ) amounts
    WHERE amount IS NOT NULL AND
      (amount <> trunc(amount) OR amount < -2147483648 OR amount > 2147483647)
  ) THEN
    RAISE EXCEPTION 'Unsafe rollback: fractional or out-of-range values exist. Retain NUMERIC columns; no values have been changed.';
  END IF;
END;
$$;
ALTER TABLE public."InvoiceLine"
  ALTER COLUMN "unitPriceHTCents" TYPE integer USING "unitPriceHTCents"::integer,
  ALTER COLUMN "discountAmountCents" TYPE integer USING "discountAmountCents"::integer;
ALTER TABLE public."QuoteLine"
  ALTER COLUMN "unitPriceHTCents" TYPE integer USING "unitPriceHTCents"::integer,
  ALTER COLUMN "discountAmountCents" TYPE integer USING "discountAmountCents"::integer;
ALTER TABLE public."Invoice"
  ALTER COLUMN "globalDiscountAmountCents" TYPE integer USING "globalDiscountAmountCents"::integer;
ALTER TABLE public."Quote"
  ALTER COLUMN "globalDiscountAmountCents" TYPE integer USING "globalDiscountAmountCents"::integer;
COMMIT;
