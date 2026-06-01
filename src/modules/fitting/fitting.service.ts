import sharp from 'sharp';
import prisma from '@/lib/prisma/extensions';
import { gemini } from '@/lib/ai/gemini';
import { AppError } from '@/common/errors/app-error';
import { ErrorCode } from '@/common/errors/error-code';
import type { Fitting2DBody } from './fitting.schema';

type FittingImages = {
  topImage?: Express.Multer.File;
  bottomImage?: Express.Multer.File;
  footwearImage?: Express.Multer.File;
};

async function toResizedBase64(buffer: Buffer): Promise<string> {
  return (
    await sharp(buffer)
      .resize(768, 768, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer()
  ).toString('base64');
}

function buildPrompt(body: Fitting2DBody, measurements: Record<string, number>, hasTopImage: boolean): string {
  const { top, bottom } = body.clothing ?? {};

  const topLine = hasTopImage
    ? `Top: ${top?.name ?? 'See image'}${top?.size ? ` in size ${top.size}` : ''}. (Refer to the attached top image)`
    : `Top: Plain white basic t-shirt. (No image provided — use a standard plain white t-shirt as default)`;

  return `
1. Character Definition (Crucial: Featureless Mannequin)
Source: Refer to the attached character image.
Model Type: Must be a neutral, blank, featureless 3D mannequin with the same body proportions as the attached character image.
Face: ABSOLUTELY NO FACIAL FEATURES. No eyes, no nose, no mouth, no eyebrows. The face must be a smooth, blank surface.
Skin/Material: Matte grey or light-toned smooth mannequin material. No realistic human skin texture, no hair.
Body Dimensions: Shoulder ${measurements.shoulder ?? 0}cm, Chest ${measurements.chest ?? 0}cm, Waist ${measurements.waist ?? 0}cm, Hips ${measurements.hips ?? 0}cm.

2. Garment Selection
${topLine}
Garment Specs: Chest Width ${top?.chestWidth ?? 0}cm, Total Length ${top?.totalLength ?? 0}cm.

Bottom: ${bottom?.name ?? 'See image'}${bottom?.size ? ` in size ${bottom.size}` : ''}. (Refer to the attached bottom image)
Garment Specs: Waist ${bottom?.waist ?? 0}cm, Hips ${bottom?.hips ?? 0}cm, Thigh ${bottom?.thigh ?? 0}cm, Total Length ${bottom?.totalLength ?? 0}cm.

Footwear: Refer to the attached footwear image.

3. Fitting Logic & Style
Instruction: Render the clothing on the mannequin by calculating the relative difference between Body Dimensions and Garment Specs.
Fit: Apply loose/oversized fit if garment is larger than body; otherwise, apply tailored fit.
Visual Style: Professional product photography, clean studio background, realistic fabric draping on a 3D mannequin.

4. Composition (CRITICAL)
- Shot Type: Strict vertical full-body studio shot.
- Framing: Render the entire mannequin from head to toe. Do NOT crop the feet.
- Technical: Complete the generation fully. Do not leave any blank or grey spaces at the bottom.

5. Quality Output
High-end fashion photography, 8k resolution, crisp textures.

CRITICAL: The image composition must be a FULL-BODY vertical shot. Do NOT cut off the bottom. Do NOT leave the bottom half empty or filled with blank blocks. Ensure the mannequin's feet are completely visible at the bottom of the frame.
  `.trim();
}

export const generate2DFitting = async (
  userId: string,
  fittingImages: FittingImages,
  fittingBody: Fitting2DBody,
) => {
  const [userCharacter, bodyInfo] = await Promise.all([
    prisma.userCharacter.findUnique({
      where: { userId },
      select: {
        imageUrl: true,
        character: { select: { imageUrl: true } },
      },
    }),
    prisma.bodyInfo.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { height: true, weight: true, measurements: true },
    }),
  ]);

  const avatarUrl = userCharacter?.imageUrl ?? userCharacter?.character?.imageUrl;

  if (!avatarUrl) {
    throw new AppError(ErrorCode.FITTING_FAILED, '아바타 정보가 없습니다.', 404);
  }

  const dbMeasurements =
    bodyInfo?.measurements && typeof bodyInfo.measurements === 'object'
      ? (bodyInfo.measurements as Record<string, number>)
      : {};

  const prompt = buildPrompt(fittingBody, dbMeasurements, !!fittingImages.topImage);

  const avatarResponse = await fetch(avatarUrl);
  if (!avatarResponse.ok) {
    throw new AppError(ErrorCode.FITTING_FAILED, '아바타 이미지를 불러올 수 없습니다.', 502);
  }
  const avatarData = await toResizedBase64(Buffer.from(await avatarResponse.arrayBuffer()));

  const garmentImages = await Promise.all(
    [
      { label: 'Top garment image:', file: fittingImages.topImage },
      { label: 'Bottom garment image:', file: fittingImages.bottomImage },
      { label: 'Footwear image:', file: fittingImages.footwearImage },
    ]
      .filter((item): item is { label: string; file: Express.Multer.File } => item.file !== undefined)
      .map(async ({ label, file }) => ({
        label,
        data: await toResizedBase64(file.buffer),
      })),
  );

  const parts: object[] = [
    { text: 'Character image:' },
    { inlineData: { mimeType: 'image/jpeg', data: avatarData } },
    ...garmentImages.flatMap(({ label, data }) => [
      { text: label },
      { inlineData: { mimeType: 'image/jpeg', data } },
    ]),
    { text: prompt },
  ];

  const response = await gemini.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: [{ role: 'user', parts }],
    config: { responseModalities: ['IMAGE'] },
  });

  const imagePart = response.candidates?.[0]?.content?.parts?.find(
    (p: { inlineData?: unknown }) => p.inlineData,
  );

  if (!imagePart?.inlineData) {
    throw new AppError(ErrorCode.GEMINI_API_ERROR, '이미지 생성에 실패했습니다.', 500);
  }

  const { mimeType, data } = imagePart.inlineData as { mimeType: string; data: string };

  return { imageUrl: `data:${mimeType};base64,${data}` };
};
