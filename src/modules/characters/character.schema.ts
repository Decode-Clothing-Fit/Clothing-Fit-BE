import { z } from 'zod';
import { Gender, BodyType } from '@prisma/client';

export const CharacterListItemSchema = z
  .object({
    id: z.string().openapi({ example: '01900000-0000-7000-8000-000000000001' }),
    gender: z.nativeEnum(Gender).openapi({ example: Gender.MALE }),
    bodyType: z.nativeEnum(BodyType).openapi({ example: BodyType.NORMAL }),
    imageUrl: z.string().url().openapi({ example: 'https://example.com/character.png' }),
  })
  .openapi('CharacterListItem');

export const CharacterListResponseSchema = z
  .object({
    MALE: z.array(CharacterListItemSchema),
    FEMALE: z.array(CharacterListItemSchema),
  })
  .openapi('CharacterListResponse');


