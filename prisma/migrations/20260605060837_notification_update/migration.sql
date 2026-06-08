/*
  Warnings:

  - You are about to drop the column `target_type` on the `notifications` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "notifications" DROP COLUMN "target_type",
ADD COLUMN     "actor_id" UUID;

-- DropEnum
DROP TYPE "NotificationTargetType";

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
