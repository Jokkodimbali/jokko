import { Controller, Get } from '@nestjs/common';
import {
  EtatSanteDto,
  ObtenirEtatSanteUseCase,
} from '../application/obtenir-etat-sante.use-case';

@Controller('sante')
export class SanteController {
  constructor(private readonly obtenirEtatSante: ObtenirEtatSanteUseCase) {}

  @Get()
  getEtatSante(): Promise<EtatSanteDto> {
    return this.obtenirEtatSante.execute();
  }
}
