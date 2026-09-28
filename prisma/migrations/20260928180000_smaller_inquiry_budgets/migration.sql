-- Smaller budget ranges for the sponsor inquiry form (plus product-only
-- deals). Old values have no exact counterpart, so any row still using one
-- becomes 'unsure' (the table was empty when this was written).

-- AlterEnum
BEGIN;
CREATE TYPE "InquiryBudget_new" AS ENUM ('under_100', 'from_100_to_250', 'from_250_to_500', 'over_500', 'product_only', 'unsure');
ALTER TABLE "Inquiry" ALTER COLUMN "budget" TYPE "InquiryBudget_new" USING (
  CASE WHEN "budget"::text = 'unsure' THEN 'unsure' ELSE 'unsure' END
)::"InquiryBudget_new";
ALTER TYPE "InquiryBudget" RENAME TO "InquiryBudget_old";
ALTER TYPE "InquiryBudget_new" RENAME TO "InquiryBudget";
DROP TYPE "InquiryBudget_old";
COMMIT;
