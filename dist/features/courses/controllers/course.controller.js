"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CourseController = void 0;
const api_response_1 = require("../../../utils/api-response");
const course_service_1 = __importDefault(require("../services/course.service"));
class CourseController {
    static async list(req, res, next) {
        try {
            const page = Number(req.query.page || 1);
            const limit = Number(req.query.limit || 20);
            const result = await course_service_1.default.listCourses(page, limit);
            return (0, api_response_1.sendSuccess)(res, result);
        }
        catch (err) {
            return next(err);
        }
    }
    static async get(req, res, next) {
        try {
            const id = req.params.id;
            const course = await course_service_1.default.getCourse(id);
            if (!course)
                return (0, api_response_1.sendError)(res, 'Course not found', 404);
            return (0, api_response_1.sendSuccess)(res, course);
        }
        catch (err) {
            return next(err);
        }
    }
    static async create(req, res, next) {
        try {
            const userId = req.user?.id || '';
            const payload = req.body;
            const course = await course_service_1.default.createCourse(payload, userId);
            return (0, api_response_1.sendSuccess)(res, course, 'Course created', 201);
        }
        catch (err) {
            return next(err);
        }
    }
    static async update(req, res, next) {
        try {
            const id = req.params.id;
            const userId = req.user?.id || '';
            const payload = req.body;
            const updated = await course_service_1.default.updateCourse(id, payload, userId);
            return (0, api_response_1.sendSuccess)(res, updated, 'Course updated');
        }
        catch (err) {
            return next(err);
        }
    }
    static async remove(req, res, next) {
        try {
            const id = req.params.id;
            const userId = req.user?.id || '';
            const removed = await course_service_1.default.deleteCourse(id, userId);
            return (0, api_response_1.sendSuccess)(res, removed, 'Course deleted');
        }
        catch (err) {
            return next(err);
        }
    }
}
exports.CourseController = CourseController;
exports.default = CourseController;
