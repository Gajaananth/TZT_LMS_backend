import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import prisma from './db/prisma/client';
import authRoutes from './routes/auth.routes';
import studentRoutes from './features/students/routes/student.routes';
import teacherRoutes from './features/teachers/routes/teacher.routes';
import attendanceRoutes from './features/attendance/routes/attendance.routes';
import feeRoutes from './features/fees/routes/fee.routes';
import courseRoutes from './features/courses/routes/course.routes';
import discussionRoutes from './features/discussions/routes/discussion.routes';
import certificateRoutes from './features/certificates/routes/certificate.routes';
import reportRoutes from './features/reports/routes/report.routes';
import searchRoutes from './features/search/routes/search.routes';
import notificationRoutes from './features/notifications/routes/notification.routes';
import questionImportRoutes from './features/questions/routes/question.import.routes';
import questionRoutes from './features/questions/routes/question.routes';
import examRoutes from './features/exams/routes/exam.routes';
import gradingRoutes from './features/grading/routes/grading.routes';
import { errorMiddleware } from './middlewares/error.middleware';
import { initializeStorageBuckets } from './lib/storage';

// Load environment variables from .env file
dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.text({ type: ['text/csv', 'application/csv'] }));

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/students', studentRoutes);
app.use('/api/v1/teachers', teacherRoutes);
app.use('/api/v1/attendance', attendanceRoutes);
app.use('/api/v1/fees', feeRoutes);
app.use('/api/v1/courses', courseRoutes);
app.use('/api/v1/discussions', discussionRoutes);
app.use('/api/v1/certificates', certificateRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/search', searchRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/questions', questionImportRoutes);
app.use('/api/v1/questions', questionRoutes);
app.use('/api/v1/exams', examRoutes);
app.use('/api/v1/grading', gradingRoutes);

// Root route & Health check
app.get('/', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'TZT Education LMS Backend API is running', timestamp: new Date().toISOString() });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.use(errorMiddleware);

// Start the server when executed directly, not when imported by tests
if (process.env.NODE_ENV !== 'test') {
  const PORT_NUM = Number(port) || 5000;
  app.listen(PORT_NUM, '0.0.0.0', async () => {
    console.log(`Server is running on http://0.0.0.0:${PORT_NUM}`);
    try {
      await prisma.$connect();
      console.log('Database connection established');
    } catch (error) {
      console.error('Failed to connect to database:', error);
    }
    // Initialize Supabase storage buckets
    try {
      await initializeStorageBuckets();
      console.log('Storage buckets initialized');
    } catch (error) {
      console.warn('Failed to initialize storage buckets:', error);
    }
    // Start fee reminder job in non-test environments
    try {
      const { startFeeReminderJob } = await import('./jobs/feeReminder.job');
      startFeeReminderJob();
      console.log('Fee reminder job started');
    } catch (e) {
      console.warn('Failed to start fee reminder job', e);
    }
  });
}

export default app;