import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { UsersRepositoryPort } from '../../application/ports/users-repository.port';

@Injectable()
export class UsersRepository implements UsersRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  findMeById(userId: string) {
    return this.prisma.utilisateur.findUnique({
      where: { id: userId },
      select: {
        id: true,
        numeroTelephone: true,
        nom: true,
        email: true,
        role: true,
        urlAvatar: true,
        estActif: true,
        creeLe: true,
      },
    });
  }
}
