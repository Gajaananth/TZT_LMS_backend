"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchController = void 0;
const api_response_1 = require("../../../utils/api-response");
const search_service_1 = __importDefault(require("../services/search.service"));
class SearchController {
    static async global(req, res, next) {
        try {
            const q = req.query.q || '';
            const page = Number(req.query.page || 1);
            const limit = Number(req.query.limit || 20);
            const result = await search_service_1.default.globalSearch(q, page, limit);
            return (0, api_response_1.sendSuccess)(res, result);
        }
        catch (err) {
            return next(err);
        }
    }
}
exports.SearchController = SearchController;
exports.default = SearchController;
