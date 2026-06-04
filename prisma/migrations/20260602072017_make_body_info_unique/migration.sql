/*
  Warnings:

  - A unique constraint covering the columns `[user_id]` on the table `body_info` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "body_info_user_id_key" ON "body_info"("user_id");
