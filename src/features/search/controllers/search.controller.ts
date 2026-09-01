import { NextFunction, Request, Response } from 'express';
import { sendError, sendSuccess } from '@/utils/api-response';
import SearchService from '../services/search.service';

export class SearchController {
  static async global(req: Request, res: Response, next: NextFunction) {
    try {
      const q = (req.query.q as string) || '';
      const page = Number(req.query.page || 1);
      const limit = Number(req.query.limit || 20);
      const result = await SearchService.globalSearch(q, page, limit);
      return sendSuccess(res, result);
    } catch (err: any) {
      return next(err);
    }
  }
}

export default SearchController;
