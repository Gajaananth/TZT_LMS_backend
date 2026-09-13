import { prisma } from '@/db/prisma/client';
import { NotificationService } from '@/features/notifications/services/notification.service';

/**
 * Periodically checks for upcoming exams and sends:
 * 1. 24-hour reminder to all enrolled students and assigned teachers
 * 2. 1-hour reminder to all enrolled students and assigned teachers
 */
export const checkAndSendExamReminders = async () => {
  try {
    const now = new Date();
    const twentyFourHoursLater = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Find all upcoming exams starting within the next 24 hours
    const upcomingExams = await prisma.exam.findMany({
      where: {
        deletedAt: null,
        startDate: {
          gt: now,
          lte: twentyFourHoursLater,
        },
      },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            code: true,
            enrollments: {
              where: {
                status: 'active',
                deletedAt: null,
              },
              include: {
                student: {
                  select: {
                    id: true,
                    userId: true,
                  },
                },
              },
            },
            teacherAssignment_course: {
              where: {
                deletedAt: null,
              },
              include: {
                teacher: {
                  select: {
                    id: true,
                    userId: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    for (const exam of upcomingExams) {
      if (!exam.startDate) continue;

      const timeUntilStartMs = new Date(exam.startDate).getTime() - now.getTime();
      const hoursUntilStart = timeUntilStartMs / (1000 * 60 * 60);

      const isOneHourWindow = hoursUntilStart <= 1.0 && hoursUntilStart > 0;
      const isTwentyFourHourWindow = hoursUntilStart <= 24.0 && hoursUntilStart > 1.0;

      // Extract unique user IDs to notify (enrolled students + assigned teachers)
      const userIdsToNotify = new Set<string>();

      // 1. Enrolled students
      if (exam.course?.enrollments) {
        for (const enrollment of exam.course.enrollments) {
          if (enrollment.student?.userId) {
            userIdsToNotify.add(enrollment.student.userId);
          }
        }
      }

      // 2. Assigned teachers
      if (exam.course?.teacherAssignment_course) {
        for (const assignment of exam.course.teacherAssignment_course) {
          if (assignment.teacher?.userId) {
            userIdsToNotify.add(assignment.teacher.userId);
          }
        }
      }

      if (userIdsToNotify.size === 0) continue;

      const formattedDate = new Date(exam.startDate).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      });

      // Handle 1-hour reminder window
      if (isOneHourWindow) {
        for (const userId of userIdsToNotify) {
          try {
            const alreadyNotified = await prisma.notification.findFirst({
              where: {
                userId,
                relatedId: exam.id,
                relatedType: 'EXAM_REMINDER_1H',
                deletedAt: null,
              },
            });

            if (!alreadyNotified) {
              await NotificationService.createNotification(
                userId,
                'EXAM',
                `⏰ Exam Starting Soon: ${exam.title}`,
                `Your assessment "${exam.title}" for ${exam.course?.title || 'your course'} starts in under 1 hour (${formattedDate}). Please ensure your environment is ready!`,
                exam.id,
                'EXAM_REMINDER_1H'
              );
            }
          } catch (err) {
            console.warn(`Failed to send 1h exam reminder to user ${userId}:`, err);
          }
        }
      }

      // Handle 24-hour reminder window
      if (isTwentyFourHourWindow) {
        for (const userId of userIdsToNotify) {
          try {
            const alreadyNotified = await prisma.notification.findFirst({
              where: {
                userId,
                relatedId: exam.id,
                relatedType: 'EXAM_REMINDER_24H',
                deletedAt: null,
              },
            });

            if (!alreadyNotified) {
              await NotificationService.createNotification(
                userId,
                'EXAM',
                `📅 Upcoming Exam Tomorrow: ${exam.title}`,
                `Reminder: Assessment "${exam.title}" for ${exam.course?.title || 'your course'} is scheduled for tomorrow at ${formattedDate}. Review your materials and prepare on time.`,
                exam.id,
                'EXAM_REMINDER_24H'
              );
            }
          } catch (err) {
            console.warn(`Failed to send 24h exam reminder to user ${userId}:`, err);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error running checkAndSendExamReminders:', error);
  }
};

/**
 * Starts periodic exam reminder background job
 * @param intervalMs interval in ms (default: 2 minutes)
 */
export const startExamReminderJob = (intervalMs: number = 1000 * 60 * 2) => {
  const run = async () => {
    await checkAndSendExamReminders();
  };

  void run();
  const timer = setInterval(run, intervalMs);

  return () => clearInterval(timer);
};
