import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { uuidv7 } from 'uuidv7';
import { env } from '@/config/env';
import { s3Client, S3_BUCKET } from './s3';

const S3_PUBLIC_PREFIX = `https://${S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/`;
const CLOSET_PREFIX = 'closet/';

/** 코디 결과 이미지 / 사용자가 캡처한 의류 이미지 구분용 네임스페이스 */
export type ClosetImageKind = 'coordi' | 'clothing';

/**
 * 코디 관련 이미지(생성된 코디 결과 또는 캡처한 의류)를 S3에 올리고 공개 URL을 반환합니다.
 * (DB 반영은 호출부 책임)
 * @param userId  S3 키 네임스페이스
 * @param buffer  이미지 바이너리
 * @param contentType  image/png | image/jpeg
 * @param kind  coordi(코디 결과) | clothing(캡처 의류)
 */
export const uploadClosetImage = async (
  userId: string,
  buffer: Buffer,
  contentType: string,
  kind: ClosetImageKind,
): Promise<string> => {
  const ext = contentType === 'image/png' ? 'png' : 'jpg';
  const key = `${CLOSET_PREFIX}${userId}/${kind}/${uuidv7()}.${ext}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  );

  return `${S3_PUBLIC_PREFIX}${key}`;
};

/**
 * 우리가 관리하는 closet/ S3 객체를 삭제합니다 (저장 실패 시 보상 정리용).
 * 정리 목적이라 실패해도 throw하지 않고 로깅만 합니다(best-effort).
 * 우리 버킷의 closet/ 객체가 아니면 아무것도 하지 않습니다.
 */
export const deleteClosetImage = async (url: string | null | undefined): Promise<void> => {
  if (!url || !url.startsWith(S3_PUBLIC_PREFIX)) return;
  const key = url.slice(S3_PUBLIC_PREFIX.length);
  if (!key.startsWith(CLOSET_PREFIX)) return;
  try {
    await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
  } catch (err) {
    console.error('[ClosetImage] S3 객체 삭제 실패:', err);
  }
};
