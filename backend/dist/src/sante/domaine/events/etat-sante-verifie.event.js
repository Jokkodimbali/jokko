"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EtatSanteVerifieEvent = void 0;
class EtatSanteVerifieEvent {
    payload;
    nom = 'sante.etat-verifie';
    dateOccurrence = new Date();
    constructor(payload) {
        this.payload = payload;
    }
}
exports.EtatSanteVerifieEvent = EtatSanteVerifieEvent;
//# sourceMappingURL=etat-sante-verifie.event.js.map