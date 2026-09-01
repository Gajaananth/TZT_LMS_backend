"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = void 0;
const zod_1 = require("zod");
const api_response_1 = require("../utils/api-response");
const validate = (schema, source = 'body') => {
    return async (req, res, next) => {
        try {
            const data = source === 'query' ? req.query : req.body;
            await schema.parseAsync(data);
            next();
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
                return (0, api_response_1.sendError)(res, 'Validation failed', 400, error.errors);
            }
            return (0, api_response_1.sendError)(res, 'Internal server error', 500);
        }
    };
};
exports.validate = validate;
