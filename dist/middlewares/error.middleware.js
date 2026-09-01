"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorMiddleware = void 0;
const app_error_1 = require("../utils/app-error");
const errorMiddleware = (err, req, res, next) => {
    const isAppError = err instanceof app_error_1.AppError;
    const statusCode = isAppError ? err.statusCode : 500;
    const code = isAppError ? (err.code || 'APP_ERROR') : 'INTERNAL_SERVER_ERROR';
    const message = isAppError ? err.message : 'Internal server error';
    console.error('[ERROR]', {
        method: req.method,
        url: req.originalUrl,
        message: err.message,
        stack: err.stack,
        code,
        statusCode,
    });
    if (res.headersSent) {
        return next(err);
    }
    return res.status(statusCode).json({
        success: false,
        data: null,
        error: {
            code,
            message,
        },
    });
};
exports.errorMiddleware = errorMiddleware;
