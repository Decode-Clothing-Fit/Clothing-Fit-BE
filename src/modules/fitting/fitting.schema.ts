import { z } from 'zod';
import { ClothingType } from '@prisma/client';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

// ───────────────────────────── 2D 코디 생성 ─────────────────────────────

/** 코디로 조합 가능한 최대 의류 수 (카테고리 5종). */
export const MAX_COORDI_ITEMS = 5;

/**
 * 선택 사이즈 기준의 납작한 치수 데이터. 측정 항목은 카테고리마다 동적으로 달라지므로 자유 키로 받는다.
 * 예: { "가슴단면": 52, "어깨너비": 44, "총장": 70 }
 */
export const CoordiMeasurementsSchema = z
    .record(z.string(), z.number())
    .openapi('CoordiMeasurements', { example: { 가슴단면: 52, 어깨너비: 44, 총장: 70 } });

export type CoordiMeasurements = z.infer<typeof CoordiMeasurementsSchema>;

/**
 * 전체 사이즈표 (사이즈 라벨 → {측정항목: 값}). 측정항목·사이즈 라벨 모두 상품마다 달라 자유 키로 받는다.
 * 예: { "M": { "가슴단면": 52 }, "L": { "가슴단면": 55 } }
 */
export const CoordiSizeTableSchema = z
    .record(z.string(), z.record(z.string(), z.number()))
    .openapi('CoordiSizeTable', { example: { M: { 가슴단면: 52, 총장: 70 }, L: { 가슴단면: 55, 총장: 72 } } });

/** 프론트가 보내는 카테고리(소문자)를 ClothingType enum으로 정규화한다. (top → TOP) */
const CoordiCategorySchema = z
    .preprocess(
        (v) => (typeof v === 'string' ? v.toUpperCase() : v),
        z.nativeEnum(ClothingType),
    )
    .openapi('CoordiCategory', { example: 'top' });

/** 의류 1건 (이미지 필드 참조 + 선택 치수 + 사이즈표 + 상품 정보). 이미지는 imageField가 가리키는 multipart 파일로 받는다. */
export const CoordiItemSchema = z
    .object({
        category: CoordiCategorySchema,
        imageField: z.string().min(1).openapi({ description: '이 의류 이미지의 multipart 파일 필드명', example: 'image_top' }),
        selectedMeasurements: CoordiMeasurementsSchema.openapi({ description: '선택 사이즈의 치수 (항목명 동적)' }),
        selectedSize: z.string().optional().openapi({ description: '선택한 사이즈 라벨 (동적: M, 270, FREE…)', example: 'M' }),
        brand: z.string().min(1, '브랜드명을 입력해주세요.').openapi({ description: '브랜드명', example: '아디다스' }),
        name: z.string().min(1, '상품명을 입력해주세요.').openapi({ description: '상품명 (브랜드 제외)', example: '와플 반팔 폴로 셔츠' }),
        sourceUrl: z.string().url().optional().openapi({ description: '제품 사이트 링크', example: 'https://www.musinsa.com/products/123' }),
        sizeTableSource: z
            .enum(['actual', 'html', 'image', 'reference'])
            .optional()
            .openapi({ description: '사이즈표 출처', example: 'html' }),
        sizeTable: CoordiSizeTableSchema.optional().openapi({ description: '전체 사이즈표 (참고/저장용)' }),
    })
    .openapi('CoordiItem');

export type CoordiItem = z.infer<typeof CoordiItemSchema>;

export const CoordiItemsSchema = z
    .array(CoordiItemSchema)
    .min(1, '의류가 최소 1개 필요합니다.')
    .max(MAX_COORDI_ITEMS, `의류는 최대 ${MAX_COORDI_ITEMS}개까지 가능합니다.`);

const coordiImageField = (label: string) =>
    z.instanceof(File).optional().openapi({ type: 'string', format: 'binary', description: label });

export const GenerateCoordiRequestSchema = z
    .object({
        meta: z.string().openapi({
            description:
                '의류 메타데이터 (JSON string). { "items": [...] } 형태이며, 각 item의 imageField가 함께 보내는 multipart 파일 필드명을 가리킵니다. 체형은 보내지 않습니다(토큰으로 DB 조회).',
            example: JSON.stringify({
                items: [
                    {
                        category: 'top',
                        selectedSize: 'M',
                        imageField: 'image_top',
                        selectedMeasurements: { 가슴단면: 52, 어깨너비: 44, 총장: 70 },
                        brand: '아디다스',
                        name: '와플 반팔 폴로 셔츠',
                        sourceUrl: 'https://www.musinsa.com/products/123',
                        sizeTableSource: 'html',
                        sizeTable: { M: { 가슴단면: 52, 총장: 70 }, L: { 가슴단면: 55, 총장: 72 } },
                    },
                    {
                        category: 'bottom',
                        selectedSize: 'L',
                        imageField: 'image_bottom',
                        selectedMeasurements: { 허리단면: 40, 총장: 100 },
                    },
                ],
            }),
        }),
        // 런타임은 multer.any()라 임의 필드명을 받지만, Swagger UI에 입력칸이 뜨도록 표준 5개 필드를 선언한다.
        // 담은 카테고리의 이미지만 보내면 되며, 각 파일은 meta.items[].imageField가 가리키는 필드명과 일치해야 한다.
        image_top: coordiImageField('상의 이미지 (image_top)'),
        image_outer: coordiImageField('아우터 이미지 (image_outer)'),
        image_bottom: coordiImageField('하의 이미지 (image_bottom)'),
        image_hat: coordiImageField('모자 이미지 (image_hat)'),
        image_shoes: coordiImageField('신발 이미지 (image_shoes)'),
    })
    .openapi('GenerateCoordiRequest');

export const GenerateCoordiResponseSchema = z
    .object({
        imageUrl: z.string().url().openapi({ description: '생성된 코디 이미지 URL' }),
        archiveId: z.string().openapi({ description: '저장된 옷장 아카이브 ID', example: '01968b1c-...' }),
        outfitName: z.string().openapi({ description: '코디명 (20자 이내)', example: '도시적인 데일리룩' }),
    })
    .openapi('GenerateCoordiResponse');

export const Fitting3DRequestSchema = z
    .object({
        closetArchiveId: z.string().uuid().openapi({ description: '2D 피팅 이미지가 저장된 옷장 아카이브 ID', example: '01968b1c-...' }),
    })
    .openapi('Fitting3DRequest');

export const Fitting3DStartResponseSchema = z
    .object({
        sessionId: z.string().openapi({ description: '상태 조회에 사용할 세션 ID (24시간 유효)', example: '01968b1c-...' }),
    })
    .openapi('Fitting3DStartResponse');

export const Fitting3DStatusResponseSchema = z
    .object({
        status: z.enum(['QUEUED', 'PROCESSING', 'SUCCEEDED', 'FAILED']).openapi({ example: 'SUCCEEDED' }),
        progress: z.number().optional().openapi({ example: 80 }),
        glbUrl: z.string().url().nullable().openapi({ example: 'https://assets.meshy.ai/...glb' }),
        thumbnailUrl: z.string().url().nullable().openapi({ example: 'https://assets.meshy.ai/...png' }),
    })
    .openapi('Fitting3DStatusResponse');

export const SessionIdParamSchema = z
    .object({
        sessionId: z.string().openapi({ example: '01968b1c-...' }),
    })
    .openapi('SessionIdParam');

export const FittingTitleParamSchema = z
    .object({
        closetArchiveId: z.string().uuid().openapi({ description: '제목을 변경할 옷장 아카이브 ID', example: '01968b1c-...' }),
    })
    .openapi('FittingTitleParam');

export const FittingTitleBodySchema = z
    .object({
        title: z.string().trim().min(1, '제목을 입력해주세요.').max(100, '제목은 100자 이하여야 합니다.').openapi({ description: '변경할 제목', example: '여름 데일리룩' }),
    })
    .openapi('FittingTitleBody');

export const UpdateFittingModelResponseSchema = z
    .object({
        modelUrl: z.string().url().openapi({ description: '저장된 3D 모델(.glb) URL', example: 'https://assets.example.com/fitting-models/.../model.glb' }),
    })
    .openapi('UpdateFittingModelResponse');
