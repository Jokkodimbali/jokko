"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SanteModule = void 0;
const common_1 = require("@nestjs/common");
const obtenir_etat_sante_use_case_1 = require("./application/obtenir-etat-sante.use-case");
const journalisation_etat_sante_handler_1 = require("./application/handlers/journalisation-etat-sante.handler");
const verificateur_base_port_1 = require("./domaine/ports/verificateur-base.port");
const verificateur_base_prisma_adapter_1 = require("./infrastructure/prisma/verificateur-base-prisma.adapter");
const sante_controller_1 = require("./presentation/sante.controller");
let SanteModule = class SanteModule {
};
exports.SanteModule = SanteModule;
exports.SanteModule = SanteModule = __decorate([
    (0, common_1.Module)({
        controllers: [sante_controller_1.SanteController],
        providers: [
            obtenir_etat_sante_use_case_1.ObtenirEtatSanteUseCase,
            journalisation_etat_sante_handler_1.JournalisationEtatSanteHandler,
            {
                provide: verificateur_base_port_1.VERIFICATEUR_BASE_PORT,
                useClass: verificateur_base_prisma_adapter_1.VerificateurBasePrismaAdapter,
            },
        ],
    })
], SanteModule);
//# sourceMappingURL=sante.module.js.map