-- Jednorázově: oprava uložených URL v tabulce Expense po přejmenování / změně Storage bucketu.
-- Příklad: staré odkazy ukazovaly na „receipts“, soubory jsou v „fakturyauctenky“.
-- Před spuštěním ověř v jednom řádku, že REPLACE dává očekávaný tvar URL.

-- Náhled (bez zápisu):
-- SELECT id, "receiptUrl",
--   REPLACE(REPLACE("receiptUrl", '/object/public/receipts/', '/object/public/fakturyauctenky/'), '/object/receipts/', '/object/public/fakturyauctenky/')
-- FROM "Expense" WHERE "receiptUrl" IS NOT NULL;

UPDATE "Expense"
SET "receiptUrl" = REPLACE(
  REPLACE("receiptUrl", '/object/public/receipts/', '/object/public/fakturyauctenky/'),
  '/object/receipts/',
  '/object/public/fakturyauctenky/'
)
WHERE "receiptUrl" IS NOT NULL
  AND (
    "receiptUrl" LIKE '%/object/public/receipts/%'
    OR "receiptUrl" LIKE '%/object/receipts/%'
  );
