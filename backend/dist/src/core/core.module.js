"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoreModule = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const config_1 = require("@nestjs/config");
const event_emitter_1 = require("@nestjs/event-emitter");
const throttler_1 = require("@nestjs/throttler");
const env_validation_1 = require("./config/env.validation");
const domaine_event_bus_port_1 = require("./events/domaine-event-bus.port");
const nest_domaine_event_bus_adapter_1 = require("./events/nest-domaine-event-bus.adapter");
let CoreModule = class CoreModule {
};
exports.CoreModule = CoreModule;
exports.CoreModule = CoreModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                cache: true,
                validate: env_validation_1.validerEnv,
            }),
            event_emitter_1.EventEmitterModule.forRoot({
                wildcard: false,
                delimiter: '.',
                newListener: false,
                removeListener: false,
                maxListeners: 20,
                verboseMemoryLeak: true,
                ignoreErrors: false,
            }),
            throttler_1.ThrottlerModule.forRoot([
                {
                    ttl: 60_000,
                    limit: 60,
                },
            ]),
        ],
        providers: [
            nest_domaine_event_bus_adapter_1.NestDomaineEventBusAdapter,
            {
                provide: domaine_event_bus_port_1.DOMAINE_EVENT_BUS,
                useExisting: nest_domaine_event_bus_adapter_1.NestDomaineEventBusAdapter,
            },
            {
                provide: core_1.APP_GUARD,
                useClass: throttler_1.ThrottlerGuard,
            },
        ],
        exports: [domaine_event_bus_port_1.DOMAINE_EVENT_BUS],
    })
], CoreModule);
//# sourceMappingURL=core.module.js.map