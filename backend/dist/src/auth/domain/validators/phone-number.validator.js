"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PhoneNumberValidator = void 0;
const common_1 = require("@nestjs/common");
const app_http_exception_1 = require("../../../core/http/app-http.exception");
let PhoneNumberValidator = class PhoneNumberValidator {
    normalizeOrThrow(phoneNumber) {
        const normalized = phoneNumber.trim();
        if (!/^\+?[1-9]\d{7,14}$/.test(normalized)) {
            throw (0, app_http_exception_1.appHttpException)('AUTH_PHONE_INVALID');
        }
        return normalized;
    }
};
exports.PhoneNumberValidator = PhoneNumberValidator;
exports.PhoneNumberValidator = PhoneNumberValidator = __decorate([
    (0, common_1.Injectable)()
], PhoneNumberValidator);
//# sourceMappingURL=phone-number.validator.js.map