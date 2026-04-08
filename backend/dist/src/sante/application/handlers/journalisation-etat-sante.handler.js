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
var JournalisationEtatSanteHandler_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.JournalisationEtatSanteHandler = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const etat_sante_verifie_event_1 = require("../../domaine/events/etat-sante-verifie.event");
let JournalisationEtatSanteHandler = JournalisationEtatSanteHandler_1 = class JournalisationEtatSanteHandler {
    logger = new common_1.Logger(JournalisationEtatSanteHandler_1.name);
    handle(event) {
        this.logger.log(`Etat de sante: ${event.payload.statut} (db: ${event.payload.baseDeDonnees})`);
    }
};
exports.JournalisationEtatSanteHandler = JournalisationEtatSanteHandler;
__decorate([
    (0, event_emitter_1.OnEvent)('sante.etat-verifie'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [etat_sante_verifie_event_1.EtatSanteVerifieEvent]),
    __metadata("design:returntype", void 0)
], JournalisationEtatSanteHandler.prototype, "handle", null);
exports.JournalisationEtatSanteHandler = JournalisationEtatSanteHandler = JournalisationEtatSanteHandler_1 = __decorate([
    (0, common_1.Injectable)()
], JournalisationEtatSanteHandler);
//# sourceMappingURL=journalisation-etat-sante.handler.js.map