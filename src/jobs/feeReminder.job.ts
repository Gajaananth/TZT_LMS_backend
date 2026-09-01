import { FeeService } from '@/features/fees/services/fee.service';
import { prisma } from '@/db/prisma/client';

// Starts a periodic job that scans active fee structures and students
export const startFeeReminderJob = (intervalMs: number = 1000 * 60 * 60) => {
  const run = async () => {
    try {
      const now = new Date();
      const feeStructures = await prisma.feeStructure.findMany({
        where: {
          isActive: true,
          deletedAt: null,
          effectiveFrom: { lte: now },
        },
      });

      for (const fs of feeStructures) {
        if (!fs.batchId || !fs.courseId) continue;

        const students = await prisma.student.findMany({ where: { batchId: fs.batchId } });

        const fallbackUser = await prisma.user.findFirst({ where: { deletedAt: null } });
        const actingUserId = fs.createdBy || fallbackUser?.id || 'system';

        for (const s of students) {
          try {
            await FeeService.checkAndCreatePaymentDue(s.id, fs.courseId, fs.batchId, actingUserId);
          } catch (e) {
            console.warn('Fee reminder: check for student failed', e);
          }
        }
      }
    } catch (e) {
      console.error('Fee reminder job failed', e);
    }
  };

  void run();
  const id = setInterval(run, intervalMs);

  return () => clearInterval(id);
};
