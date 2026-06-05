import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { uuidv7 } from 'uuidv7';
import { env } from '@/config/env';
import { validateAndNormalizeImage } from '@/common/utils/image';
import { s3Client, S3_BUCKET } from './s3';

const S3_PUBLIC_PREFIX = `https://${S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/`;
const AVATAR_PREFIX = 'avatars/';

/**
 * 저장된 imageUrl에서 우리가 관리하는 아바타 S3 객체 키를 추출합니다.
 * 우리 버킷의 'avatars/' 프리픽스 객체만 대상으로 하여, 외부 URL이나 캐릭터 이미지를 잘못 삭제하지 않도록 합니다.
 */
export const extractAvatarS3Key = (url: string | null | undefined): string | null => {
    if (!url || !url.startsWith(S3_PUBLIC_PREFIX)) return null;
    const key = url.slice(S3_PUBLIC_PREFIX.length);
    return key.startsWith(AVATAR_PREFIX) ? key : null;
};

/**
 * 업로드 이미지를 검증·정규화한 뒤 S3에 올리고 공개 URL을 반환합니다.
 * (DB 반영은 호출부 책임)
 */
export const uploadAvatarImage = async (userId: string, buffer: Buffer): Promise<{ imageUrl: string; key: string }> => {
    const { buffer: normalized, format, ext } = await validateAndNormalizeImage(buffer);

    const key = `${AVATAR_PREFIX}${userId}/${uuidv7()}.${ext}`;
    await s3Client.send(
        new PutObjectCommand({
            Bucket: S3_BUCKET,
            Key: key,
            Body: normalized,
            ContentType: `image/${format}`,
        }),
    );

    return { imageUrl: `${S3_PUBLIC_PREFIX}${key}`, key };
};

/**
 * 이전 아바타 이미지 객체를 삭제합니다(교체/전환 시 정리용).
 * 정리 목적이므로 실패해도 throw하지 않고 로깅만 합니다(best-effort).
 * 우리가 관리하는 avatars/ 객체가 아니면 아무것도 하지 않습니다.
 */
export const deleteAvatarImage = async (url: string | null | undefined): Promise<void> => {
    const key = extractAvatarS3Key(url);
    if (!key) return;
    try {
        await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
    } catch (err) {
        console.error('[AvatarImage] 이전 S3 객체 삭제 실패:', err);
    }
};
