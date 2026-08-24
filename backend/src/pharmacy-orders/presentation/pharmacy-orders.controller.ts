import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/security/current-user.decorator';
import type { AuthUser } from '../../auth/security/auth-user.type';
import { JwtAuthGuard } from '../../auth/security/jwt-auth.guard';
import { createApiResponse } from '../../shared/dto/api-response.dto';
import { PharmacyOrdersService } from '../application/pharmacy-orders.service';
import {
  CreatePharmacyOrderDto,
  ListNearbyPharmaciesDto,
  ValidatePharmacyOrderDto,
  InitiatePharmacyOrderPaymentDto,
} from './dto/pharmacy-orders.dto';
import { PharmacyOrderPaymentService } from '../../payments/application/services/pharmacy-order-payment.service';

@ApiTags('Commandes pharmacie')
@ApiBearerAuth()
@Controller('pharmacy-orders')
@UseGuards(JwtAuthGuard)
export class PharmacyOrdersController {
  constructor(
    private readonly orders: PharmacyOrdersService,
    private readonly payments: PharmacyOrderPaymentService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePharmacyOrderDto,
  ) {
    return createApiResponse(
      await this.orders.create(user, dto),
      'Ordonnance envoyee a la pharmacie.',
    );
  }

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    return createApiResponse(await this.orders.list(user));
  }

  @Get('nearby')
  async nearby(@Query() query: ListNearbyPharmaciesDto) {
    return createApiResponse(await this.orders.listNearbyPharmacies(query));
  }

  @Get('access')
  async access(@CurrentUser() user: AuthUser) {
    return createApiResponse(await this.orders.getAccess(user));
  }

  @Get(':id')
  async get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return createApiResponse(await this.orders.get(user, id));
  }

  @Get(':id/delivery-offer')
  async getDeliveryOffer(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return createApiResponse(await this.orders.getDeliveryOffer(user, id));
  }

  @Post(':id/delivery/accept')
  async acceptDelivery(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return createApiResponse(
      await this.orders.acceptDelivery(user, id),
      'Livraison acceptee.',
    );
  }

  @Patch(':id/validation')
  async validate(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ValidatePharmacyOrderDto,
  ) {
    return createApiResponse(
      await this.orders.validate(user, id, dto),
      'Commande pharmacie mise a jour.',
    );
  }

  @Post(':id/payment')
  @HttpCode(HttpStatus.CREATED)
  async initiatePayment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: InitiatePharmacyOrderPaymentDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return createApiResponse(
      await this.payments.initiate(user, id, { ...dto, idempotencyKey }),
      'Paiement des medicaments initialise.',
    );
  }

  @Post(':id/payment/mock-confirm')
  async confirmMockPayment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return createApiResponse(
      await this.payments.confirmMock(user, id),
      'Paiement des medicaments confirme.',
    );
  }
}
