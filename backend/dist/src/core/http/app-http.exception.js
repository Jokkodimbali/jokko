"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appMessage = appMessage;
exports.appHttpException = appHttpException;
const common_1 = require("@nestjs/common");
const message_catalog_1 = require("./message-catalog");
function appMessage(key) {
    return message_catalog_1.APP_MESSAGE_CATALOG[key];
}
function appHttpException(key, details) {
    const entry = message_catalog_1.APP_MESSAGE_CATALOG[key];
    const payload = {
        message: entry.message,
        errorCode: entry.code,
    };
    if (details !== undefined) {
        payload.details = details;
    }
    return new common_1.HttpException(payload, entry.httpStatus);
}
//# sourceMappingURL=app-http.exception.js.map