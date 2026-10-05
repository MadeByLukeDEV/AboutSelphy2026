-- AlterTable
ALTER TABLE "DiscordSchedule" ADD COLUMN     "pingRoleId" VARCHAR(20),
ADD COLUMN     "weeklyPost" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "weeklyPostWeek" VARCHAR(10);


-- Hand-added: a Discord role id is a snowflake (digits only).
ALTER TABLE "DiscordSchedule" ADD CONSTRAINT "DiscordSchedule_pingRoleId_check" CHECK ("pingRoleId" IS NULL OR "pingRoleId" ~ '^[0-9]{17,20}$');
