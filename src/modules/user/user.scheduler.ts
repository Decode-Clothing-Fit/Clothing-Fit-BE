import cron from 'node-cron';
import prisma from '@/lib/prisma/extensions';
import { logger } from '@/lib/logger/logger';

const RECOVERY_DAYS = 7;

/**
 * 탈퇴 후 7일이 지난 계정을 매일 자정에 하드딜리트
 * - RefreshToken은 탈퇴 시 이미 삭제됨
 * - Profile, BodyInfo 등 연관 데이터는 Cascade로 함께 삭제
 */
const hardDeleteExpiredUsers = async (): Promise<void> => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RECOVERY_DAYS);

  const { count } = await prisma.user.deleteMany({
    where: {
      deletedAt: { not: null, lte: cutoff },
    },
  });

  if (count > 0) {
    logger.info(`[UserScheduler] 만료 계정 하드딜리트 완료: ${count}건`);
  }
};

export const startUserScheduler = (): void => {
  // 매일 자정(00:00) 실행
  cron.schedule('0 0 * * *', () => {
    hardDeleteExpiredUsers().catch((err) => {
      logger.error('[UserScheduler] 하드딜리트 실패:', err);
    });
  });

  logger.info('[UserScheduler] 회원 만료 스케줄러 시작');
};
