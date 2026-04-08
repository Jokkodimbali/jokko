import { PrismaService } from '../../../prisma/prisma.service';
import { VerificateurBasePort } from '../../domaine/ports/verificateur-base.port';
export declare class VerificateurBasePrismaAdapter implements VerificateurBasePort {
    private readonly prisma;
    constructor(prisma: PrismaService);
    verifierConnexion(): Promise<boolean>;
}
