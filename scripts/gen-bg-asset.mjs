// src/assets/coordi-background.png → base64 TS 모듈 생성기.
// 배포 시 정적 png가 dist로 복사되지 않으므로, base64를 .ts 상수로 박아 tsc가 함께 컴파일하게 한다.
// 사용: node scripts/gen-bg-asset.mjs
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';

const SRC = 'src/assets/coordi-background.png';
const OUT = 'src/assets/coordi-background.ts';

const buf = await sharp(SRC)
    // 참조용 배경이라 원본 해상도까지 필요 없음. 1024 이내로 줄여 base64 크기를 낮춘다.
    .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 90 }) // 그라데이션 배경이라 밴딩 방지를 위해 q90
    .toBuffer();

const b64 = buf.toString('base64');
const ts = `// AUTO-GENERATED from ${SRC} by scripts/gen-bg-asset.mjs. 손으로 수정하지 말 것.
// 프리셋 아바타 코디 생성 시 Gemini에 "고정 배경(Image 3)"으로 함께 전달되는 스튜디오 배경 (JPEG/base64).
export const COORDI_BACKGROUND_MIME = 'image/jpeg';
export const COORDI_BACKGROUND_BASE64 =
    '${b64}';
`;

writeFileSync(OUT, ts);
console.log(`wrote ${OUT}: ${(buf.length / 1024).toFixed(1)}KB jpeg, ${b64.length} base64 chars`);
