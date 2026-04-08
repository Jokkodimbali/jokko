"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerifyOtpDto = void 0;
const class_validator_1 = require("class-validator");
const message_catalog_1 = require("../../../core/http/message-catalog");
class VerifyOtpDto {
    phoneNumber;
    code;
}
exports.VerifyOtpDto = VerifyOtpDto;
__decorate([
    (0, class_validator_1.IsString)({ message: message_catalog_1.VALIDATION_MESSAGES.PHONE_REQUIRED }),
    (0, class_validator_1.Matches)(/^\+?[1-9]\d{7,14}$/, {
        message: message_catalog_1.VALIDATION_MESSAGES.PHONE_FORMAT,
    }),
    __metadata("design:type", String)
], VerifyOtpDto.prototype, "phoneNumber", void 0);
__decorate([
    (0, class_validator_1.IsString)({ message: message_catalog_1.VALIDATION_MESSAGES.OTP_CODE_REQUIRED }),
    (0, class_validator_1.Length)(6, 6, { message: message_catalog_1.VALIDATION_MESSAGES.OTP_CODE_LENGTH }),
    __metadata("design:type", String)
], VerifyOtpDto.prototype, "code", void 0);
//# sourceMappingURL=verify-otp.dto.js.map