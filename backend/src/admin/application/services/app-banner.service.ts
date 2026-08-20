import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import { appHttpException } from '../../../core/http/app-http.exception';
import { PrismaService } from '../../../prisma/prisma.service';

export type AppBannerInput = {
  imageUrl: string;
  redirectUrl?: string | null;
  isActive?: boolean;
};

@Injectable()
export class AppBannerService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublic() {
    return this.prisma.banniereApplication
      .findMany({
        where: { estActive: true },
        orderBy: [{ ordre: 'asc' }, { creeLe: 'asc' }],
        select: { id: true, imageUrl: true, lien: true },
      })
      .then((items) =>
        items.map((item) => ({
          id: item.id,
          imageUrl: item.imageUrl,
          redirectUrl: item.lien,
        })),
      );
  }

  async listAdmin(user: AuthUser) {
    this.assertAdmin(user);
    return this.prisma.banniereApplication.findMany({
      orderBy: [{ ordre: 'asc' }, { creeLe: 'asc' }],
    });
  }

  async replaceAll(user: AuthUser, items: AppBannerInput[]) {
    this.assertAdmin(user);
    if (items.length > 5) throw appHttpException('VALIDATION_REQUEST_INVALID');
    const normalized = items.map((item, ordre) => ({
      imageUrl: item.imageUrl.trim(),
      lien: item.redirectUrl?.trim() || null,
      estActive: item.isActive !== false,
      ordre,
    }));
    if (
      normalized.some(
        (item) =>
          !this.isHttpUrl(item.imageUrl) ||
          (item.lien && !this.isHttpUrl(item.lien)),
      )
    )
      throw appHttpException('VALIDATION_REQUEST_INVALID');
    await this.prisma.$transaction([
      this.prisma.banniereApplication.deleteMany(),
      ...normalized.map((item) =>
        this.prisma.banniereApplication.create({ data: item }),
      ),
    ]);
    return this.listAdmin(user);
  }

  private assertAdmin(user: AuthUser) {
    if (user.role !== 'ADMIN')
      throw appHttpException('USERS_ADMIN_FORBIDDEN_ROLE');
  }
  private isHttpUrl(value: string) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' || url.protocol === 'http:';
    } catch {
      return false;
    }
  }
}
