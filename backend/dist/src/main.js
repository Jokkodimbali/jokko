"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const helmet_1 = __importDefault(require("helmet"));
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const api_exception_filter_1 = require("./core/http/api-exception.filter");
const validation_exception_factory_1 = require("./core/http/validation-exception.factory");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const configService = app.get(config_1.ConfigService);
    app.use((0, helmet_1.default)());
    app.enableCors({ origin: true, credentials: true });
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        forbidUnknownValues: true,
        transform: true,
        exceptionFactory: (errors) => (0, validation_exception_factory_1.buildValidationException)(errors),
    }));
    app.useGlobalFilters(new api_exception_filter_1.ApiExceptionFilter());
    app.setGlobalPrefix('api/v1');
    app.enableShutdownHooks();
    const port = configService.get('PORT') ?? 3000;
    await app.listen(port);
}
void bootstrap();
//# sourceMappingURL=main.js.map