"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const client_1 = __importDefault(require("./db/prisma/client"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const student_routes_1 = __importDefault(require("./features/students/routes/student.routes"));
const teacher_routes_1 = __importDefault(require("./features/teachers/routes/teacher.routes"));
const attendance_routes_1 = __importDefault(require("./features/attendance/routes/attendance.routes"));
const fee_routes_1 = __importDefault(require("./features/fees/routes/fee.routes"));
const course_routes_1 = __importDefault(require("./features/courses/routes/course.routes"));
const discussion_routes_1 = __importDefault(require("./features/discussions/routes/discussion.routes"));
const certificate_routes_1 = __importDefault(require("./features/certificates/routes/certificate.routes"));
const report_routes_1 = __importDefault(require("./features/reports/routes/report.routes"));
const search_routes_1 = __importDefault(require("./features/search/routes/search.routes"));
const notification_routes_1 = __importDefault(require("./features/notifications/routes/notification.routes"));
const question_import_routes_1 = __importDefault(require("./features/questions/routes/question.import.routes"));
const question_routes_1 = __importDefault(require("./features/questions/routes/question.routes"));
const exam_routes_1 = __importDefault(require("./features/exams/routes/exam.routes"));
const grading_routes_1 = __importDefault(require("./features/grading/routes/grading.routes"));
const error_middleware_1 = require("./middlewares/error.middleware");
// Load environment variables from .env file
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = process.env.PORT || 5000;
// Middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
app.use(express_1.default.text({ type: ['text/csv', 'application/csv'] }));
// Routes
app.use('/api/v1/auth', auth_routes_1.default);
app.use('/api/v1/students', student_routes_1.default);
app.use('/api/v1/teachers', teacher_routes_1.default);
app.use('/api/v1/attendance', attendance_routes_1.default);
app.use('/api/v1/fees', fee_routes_1.default);
app.use('/api/v1/courses', course_routes_1.default);
app.use('/api/v1/discussions', discussion_routes_1.default);
app.use('/api/v1/certificates', certificate_routes_1.default);
app.use('/api/v1/reports', report_routes_1.default);
app.use('/api/v1/search', search_routes_1.default);
app.use('/api/v1/notifications', notification_routes_1.default);
app.use('/api/v1/questions', question_import_routes_1.default);
app.use('/api/v1/questions', question_routes_1.default);
app.use('/api/v1/exams', exam_routes_1.default);
app.use('/api/v1/grading', grading_routes_1.default);
// Root route & Health check
app.get('/', (req, res) => {
    res.status(200).json({ status: 'OK', message: 'TZT Education LMS Backend API is running', timestamp: new Date().toISOString() });
});
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});
app.use(error_middleware_1.errorMiddleware);
// Start the server when executed directly, not when imported by tests
if (process.env.NODE_ENV !== 'test') {
    const PORT_NUM = Number(port) || 5000;
    app.listen(PORT_NUM, '0.0.0.0', async () => {
        console.log(`Server is running on http://0.0.0.0:${PORT_NUM}`);
        try {
            await client_1.default.$connect();
            console.log('Database connection established');
        }
        catch (error) {
            console.error('Failed to connect to database:', error);
        }
        // Start fee reminder job in non-test environments
        try {
            const { startFeeReminderJob } = await Promise.resolve().then(() => __importStar(require('./jobs/feeReminder.job')));
            startFeeReminderJob();
            console.log('Fee reminder job started');
        }
        catch (e) {
            console.warn('Failed to start fee reminder job', e);
        }
    });
}
exports.default = app;
