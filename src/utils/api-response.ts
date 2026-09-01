import { Response } from 'express';

const getErrorCode = (statusCode: number, errors: any) => {
  if (statusCode === 400 && errors) return 'VALIDATION_ERROR';
  switch (statusCode) {
    case 400:
      return 'BAD_REQUEST';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 422:
      return 'UNPROCESSABLE_ENTITY';
    default:
      return 'INTERNAL_SERVER_ERROR';
  }
};

export const sendSuccess = (res: Response, data: any, message: string = 'Success', statusCode: number = 200) => {
  return res.status(statusCode).json({
    success: true,
    data,
    error: null,
  });
};

export const sendError = (res: Response, message: string, statusCode: number = 500, errors: any = null) => {
  return res.status(statusCode).json({
    success: false,
    data: null,
    error: {
      code: getErrorCode(statusCode, errors),
      message,
      details: errors,
    },
  });
};
