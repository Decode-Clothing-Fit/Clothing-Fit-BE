-- DropForeignKey
ALTER TABLE "posts" DROP CONSTRAINT "posts_closet_archive_id_fkey";

-- AlterTable
ALTER TABLE "posts" ALTER COLUMN "closet_archive_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_closet_archive_id_fkey" FOREIGN KEY ("closet_archive_id") REFERENCES "closet_archive"("id") ON DELETE SET NULL ON UPDATE CASCADE;
