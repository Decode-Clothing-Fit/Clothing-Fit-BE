-- DropForeignKey
ALTER TABLE "device_tokens" DROP CONSTRAINT "device_tokens_user_id_fkey";

-- AddForeignKey
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
