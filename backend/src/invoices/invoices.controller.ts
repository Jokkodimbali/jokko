import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/security/jwt-auth.guard';
import { CurrentUser } from '../auth/security/current-user.decorator';
import type { AuthUser } from '../auth/security/auth-user.type';
import { Roles, RolesGuard } from '../shared/guards/roles.guard';
import { createApiResponse } from '../shared/dto/api-response.dto';
import { CloudinaryMediaService } from '../shared/media/cloudinary-media.service';
import { InvoiceTemplateService } from './invoice-template.service';
import { InvoiceTemplateDto } from './invoice-template.dto';
import { InvoicesService } from './invoices.service';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvoicesController {
  constructor(
    private readonly templates: InvoiceTemplateService,
    private readonly invoices: InvoicesService,
    private readonly media: CloudinaryMediaService,
  ) {}

  @Get('admin/app-settings/invoice')
  @Roles('ADMIN')
  async settings() {
    return createApiResponse(await this.templates.get(), 'Modèle de facture.');
  }

  @Put('admin/app-settings/invoice')
  @Roles('ADMIN')
  async save(@Body() body: InvoiceTemplateDto) {
    return createApiResponse(
      await this.templates.update(body),
      'Modèle de facture enregistré.',
    );
  }

  @Post('admin/app-settings/invoice/image')
  @Roles('ADMIN')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, done) => {
        const allowed = ['image/png', 'image/jpeg', 'image/webp'].includes(
          file.mimetype,
        );
        done(
          allowed
            ? null
            : new BadRequestException('Formats acceptés : PNG, JPEG et WebP.'),
          allowed,
        );
      },
    }),
  )
  async upload(
    @UploadedFile()
    file?: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
    },
  ) {
    if (!file) throw new BadRequestException('Image manquante.');
    const bytes = file.buffer;
    const valid =
      (file.mimetype === 'image/png' &&
        bytes
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
      (file.mimetype === 'image/jpeg' &&
        bytes.length > 3 &&
        bytes[0] === 0xff &&
        bytes[1] === 0xd8 &&
        bytes[2] === 0xff) ||
      (file.mimetype === 'image/webp' &&
        bytes.length > 12 &&
        bytes.toString('ascii', 0, 4) === 'RIFF' &&
        bytes.toString('ascii', 8, 12) === 'WEBP');
    if (!valid)
      throw new BadRequestException('Le contenu de l’image est invalide.');
    const uploaded = await this.media.upload({
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
      folder: 'jokko/invoices',
    });
    return createApiResponse(
      { imageUrl: uploaded.secureUrl },
      'Image importée.',
    );
  }

  @Get('invoices/reservations/:id')
  async reservation(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return createApiResponse(
      await this.invoices.reservation(user, id),
      'Facture de prestation.',
    );
  }

  @Get('invoices/orders/:kind/:id')
  async order(
    @CurrentUser() user: AuthUser,
    @Param('kind') kind: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (kind !== 'MEDICAMENTS' && kind !== 'MATERIEL')
      throw new BadRequestException('Type de commande invalide.');
    return createApiResponse(
      await this.invoices.order(user, kind, id),
      'Facture de commande.',
    );
  }
}
