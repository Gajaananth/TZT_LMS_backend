import { Response } from 'express';
import { sendSuccess, sendError } from '../src/utils/api-response';

describe('API Response Utilities', () => {
  let mockResponse: Partial<Response>;
  let jsonSpy: jest.Mock;
  let statusSpy: jest.Mock;

  beforeEach(() => {
    jsonSpy = jest.fn().mockReturnValue({});
    statusSpy = jest.fn().mockReturnValue({ json: jsonSpy });

    mockResponse = {
      status: statusSpy,
      json: jsonSpy
    } as any;
  });

  describe('sendSuccess', () => {
    it('should send success response with default status 200', () => {
      const data = { id: '123', name: 'Test' };

      sendSuccess(mockResponse as Response, data, 'Success');

      expect(statusSpy).toHaveBeenCalledWith(200);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        data,
        error: null
      });
    });

    it('should send success response with custom status code', () => {
      const data = { id: '123', name: 'Test' };

      sendSuccess(mockResponse as Response, data, 'Created', 201);

      expect(statusSpy).toHaveBeenCalledWith(201);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        data,
        error: null
      });
    });

    it('should send success response with null data', () => {
      sendSuccess(mockResponse as Response, null, 'Deleted');

      expect(statusSpy).toHaveBeenCalledWith(200);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        data: null,
        error: null
      });
    });
  });

  describe('sendError', () => {
    it('should send error response with default status 500', () => {
      sendError(mockResponse as Response, 'Internal Server Error');

      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        data: null,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Internal Server Error',
          details: null
        }
      });
    });

    it('should send error response with custom status code', () => {
      sendError(mockResponse as Response, 'Bad Request', 400);

      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        data: null,
        error: {
          code: 'BAD_REQUEST',
          message: 'Bad Request',
          details: null
        }
      });
    });

    it('should send error response with error details', () => {
      const details = { field: 'email', message: 'Invalid email format' };

      sendError(mockResponse as Response, 'Validation Error', 400, details);

      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation Error',
          details
        }
      });
    });
  });
});
