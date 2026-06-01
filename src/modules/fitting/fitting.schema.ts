import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

export const ClothingMeasurementsSchema = z
  .object({
    top: z
      .object({
        name: z.string().optional().openapi({ description: '상의 이름' }),
        size: z.string().optional().openapi({ description: '상의 사이즈' }),
        chestWidth: z.number().optional().openapi({ description: '상의 가슴 너비 (cm)' }),
        totalLength: z.number().optional().openapi({ description: '상의 총 길이 (cm)' }),
        shoulder: z.number().optional().openapi({ description: '상의 어깨 너비 (cm)' }),
        waist: z.number().optional().openapi({ description: '상의 허리 둘레 (cm)' }),
      })
      .optional()
      .openapi({ description: '상의 치수 정보' }),
    bottom: z
      .object({
        name: z.string().optional().openapi({ description: '하의 이름' }),
        size: z.string().optional().openapi({ description: '하의 사이즈' }),
        waist: z.number().optional().openapi({ description: '하의 허리 둘레 (cm)' }),
        hips: z.number().optional().openapi({ description: '하의 엉덩이 둘레 (cm)' }),
        thigh: z.number().optional().openapi({ description: '하의 허벅지 둘레 (cm)' }),
        totalLength: z.number().optional().openapi({ description: '하의 총 길이 (cm)' }),
      })
      .optional()
      .openapi({ description: '하의 치수 정보' }),
  })
  .openapi('ClothingMeasurements');

export type ClothingMeasurements = z.infer<typeof ClothingMeasurementsSchema>;

export const Fitting2DBodySchema = z
  .object({
    clothing: ClothingMeasurementsSchema.optional().openapi({ description: '의류 치수 정보' }),
  })
  .openapi('Fitting2DBody');

export type Fitting2DBody = z.infer<typeof Fitting2DBodySchema>;

export const Fitting2DRequestSchema = z
  .object({
    topImage: z.instanceof(File).optional().openapi({
      type: 'string',
      format: 'binary',
      description: '상의 이미지 (없으면 흰 티셔츠로 대체)',
    }),
    bottomImage: z.instanceof(File).optional().openapi({
      type: 'string',
      format: 'binary',
      description: '하의 이미지',
    }),
    footwearImage: z.instanceof(File).optional().openapi({
      type: 'string',
      format: 'binary',
      description: '신발 이미지',
    }),
    clothing: z.string().optional().openapi({
      description: '의류 치수 정보 (JSON string)',
      example: JSON.stringify({
        top: { name: '오버핏 셔츠', size: 'L', chestWidth: 58, totalLength: 72, shoulder: 48 },
        bottom: { name: '슬랙스', size: 'M', waist: 76, hips: 98, thigh: 56, totalLength: 105 },
      }),
    }),
  })
  .openapi('Fitting2DRequest');

export const Fitting2DResponseSchema = z
  .object({
    data: z.object({
      imageUrl: z.string().openapi({ description: '생성된 2D 피팅 이미지 (base64 data URL)' }),
    }),
  })
  .openapi('Fitting2DResponse');
