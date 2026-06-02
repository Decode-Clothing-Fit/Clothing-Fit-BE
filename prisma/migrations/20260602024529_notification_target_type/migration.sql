/*
  Warnings:

  - The `target_type` column on the `notifications` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "NotificationTargetType" AS ENUM ('POST', 'USER');

-- AlterTable
ALTER TABLE "notifications" DROP COLUMN "target_type",
ADD COLUMN     "target_type" "NotificationTargetType";
