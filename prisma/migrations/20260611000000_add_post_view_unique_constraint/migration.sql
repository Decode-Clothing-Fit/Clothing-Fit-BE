-- AlterTable: post_views에 (user_id, post_id) 유니크 제약 추가
CREATE UNIQUE INDEX IF NOT EXISTS "post_views_user_id_post_id_key" ON "post_views"("user_id", "post_id");
