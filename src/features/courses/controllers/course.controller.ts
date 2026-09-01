import { NextFunction, Request, Response } from 'express';
import { sendError, sendSuccess } from '@/utils/api-response';
import CourseService from '../services/course.service';

export class CourseController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const page = Number(req.query.page || 1);
      const limit = Number(req.query.limit || 20);
      const result = await CourseService.listCourses(page, limit);
      return sendSuccess(res, result);
    } catch (err: any) {
      return next(err);
    }
  }

  static async get(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id;
      const course = await CourseService.getCourse(id);
      if (!course) return sendError(res, 'Course not found', 404);
      return sendSuccess(res, course);
    } catch (err: any) {
      return next(err);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id || '';
      const payload = req.body;
      const course = await CourseService.createCourse(payload, userId);
      return sendSuccess(res, course, 'Course created', 201);
    } catch (err: any) {
      return next(err);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id;
      const userId = (req as any).user?.id || '';
      const payload = req.body;
      const updated = await CourseService.updateCourse(id, payload, userId);
      return sendSuccess(res, updated, 'Course updated');
    } catch (err: any) {
      return next(err);
    }
  }

  static async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id;
      const userId = (req as any).user?.id || '';
      const removed = await CourseService.deleteCourse(id, userId);
      return sendSuccess(res, removed, 'Course deleted');
    } catch (err: any) {
      return next(err);
    }
  }
}

export default CourseController;
