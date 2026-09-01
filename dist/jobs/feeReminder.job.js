"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startFeeReminderJob = void 0;
const fee_service_1 = require("../features/fees/services/fee.service");
const client_1 = require("../db/prisma/client");
// Starts a periodic job that scans active fee structures and students
const startFeeReminderJob = (intervalMs = 1000 * 60 * 60) => {
    const run = async () => {
        try {
            const now = new Date();
            const feeStructures = await client_1.prisma.feeStructure.findMany({
                where: {
                    isActive: true,
                    deletedAt: null,
                    effectiveFrom: { lte: now },
                },
            });
            for (const fs of feeStructures) {
                if (!fs.batchId || !fs.courseId)
                    continue;
                const students = await client_1.prisma.student.findMany({ where: { batchId: fs.batchId } });
                const fallbackUser = await client_1.prisma.user.findFirst({ where: { deletedAt: null } });
                const actingUserId = fs.createdBy || fallbackUser?.id || 'system';
                for (const s of students) {
                    try {
                        await fee_service_1.FeeService.checkAndCreatePaymentDue(s.id, fs.courseId, fs.batchId, actingUserId);
                    }
                    catch (e) {
                        console.warn('Fee reminder: check for student failed', e);
                    }
                }
            }
        }
        catch (e) {
            console.error('Fee reminder job failed', e);
        }
    };
    void run();
    const id = setInterval(run, intervalMs);
    return () => clearInterval(id);
};
exports.startFeeReminderJob = startFeeReminderJob;
