-- AlterTable
ALTER TABLE "DiscordSchedule" ADD COLUMN     "messageWeek" VARCHAR(10);


-- Hand-added: format check, and the message already posted keeps the week
-- it was posted for (the Monday post records that week in weeklyPostWeek).
ALTER TABLE "DiscordSchedule" ADD CONSTRAINT "DiscordSchedule_message_week_check" CHECK ("messageWeek" IS NULL OR "messageWeek" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$');
UPDATE "DiscordSchedule" SET "messageWeek" = "weeklyPostWeek" WHERE "messageId" IS NOT NULL AND "weeklyPostWeek" IS NOT NULL;
