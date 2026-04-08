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
exports.GoogleAuthService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const google_auth_library_1 = require("google-auth-library");
const app_http_exception_1 = require("../../core/http/app-http.exception");
let GoogleAuthService = class GoogleAuthService {
    configService;
    client = new google_auth_library_1.OAuth2Client();
    constructor(configService) {
        this.configService = configService;
    }
    async verifyIdToken(idToken) {
        const audience = this.configService.get('GOOGLE_CLIENT_ID');
        if (!audience) {
            throw (0, app_http_exception_1.appHttpException)('AUTH_GOOGLE_NOT_CONFIGURED');
        }
        const ticket = await this.client.verifyIdToken({
            idToken,
            audience,
        });
        const payload = ticket.getPayload();
        if (!payload) {
            throw (0, app_http_exception_1.appHttpException)('AUTH_GOOGLE_ACCOUNT_INVALID');
        }
        return payload;
    }
};
exports.GoogleAuthService = GoogleAuthService;
exports.GoogleAuthService = GoogleAuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], GoogleAuthService);
//# sourceMappingURL=google-auth.service.js.map