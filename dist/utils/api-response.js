"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendError = exports.sendSuccess = void 0;
const getErrorCode = (statusCode, errors) => {
    if (statusCode === 400 && errors)
        return 'VALIDATION_ERROR';
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
const sendSuccess = (res, data, message = 'Success', statusCode = 200) => {
    return res.status(statusCode).json({
        success: true,
        data,
        error: null,
    });
};
exports.sendSuccess = sendSuccess;
const sendError = (res, message, statusCode = 500, errors = null) => {
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
exports.sendError = sendError;
