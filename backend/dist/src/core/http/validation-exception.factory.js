"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildValidationException = buildValidationException;
const common_1 = require("@nestjs/common");
const app_http_exception_1 = require("./app-http.exception");
const message_catalog_1 = require("./message-catalog");
function normalizeValidationMessage(message) {
    if (message.includes('should not exist')) {
        return message_catalog_1.VALIDATION_MESSAGES.NON_WHITELISTED_FIELD;
    }
    return message;
}
function flattenValidationErrors(errors, accumulator) {
    for (const error of errors) {
        if (error.constraints) {
            for (const message of Object.values(error.constraints)) {
                accumulator.push(normalizeValidationMessage(message));
            }
        }
        if (error.children?.length) {
            flattenValidationErrors(error.children, accumulator);
        }
    }
}
function buildValidationException(errors) {
    const validationEntry = (0, app_http_exception_1.appMessage)('VALIDATION_REQUEST_INVALID');
    const messages = [];
    flattenValidationErrors(errors, messages);
    return new common_1.BadRequestException({
        message: messages.length > 0 ? messages : [validationEntry.message],
        errorCode: validationEntry.code,
    });
}
//# sourceMappingURL=validation-exception.factory.js.map