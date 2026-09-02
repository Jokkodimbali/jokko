import {
  Body,
  Controller,
  Get,
  Headers,
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
import { MaterialOrderPaymentService } from '../../payments/application/services/material-order-payment.service';
import { MaterialOrdersService } from '../application/material-orders.service';
import {
  ConfigureMaterialDeliveryDto,
  CreateMaterialOrderDto,
  NearbyHardwareStoresDto,
  InitiateMaterialOrderPaymentDto,
  ValidateMaterialOrderDto,
} from './dto/material-orders.dto';

@ApiTags('Commandes materiel')
@ApiBearerAuth()
@Controller('material-orders')
@UseGuards(JwtAuthGuard)
export class MaterialOrdersController {
  constructor(
    private readonly orders: MaterialOrdersService,
    private readonly payments: MaterialOrderPaymentService,
  ) {}

  @Get('nearby')
  async nearby(@Query() query: NearbyHardwareStoresDto) {
    return createApiResponse(await this.orders.listNearby(query));
  }

  @Get('access')
  async access(@CurrentUser() user: AuthUser) {
    return createApiResponse(await this.orders.getAccess(user));
  }

  @Get('eligibility/:reservationId')
  async eligibility(
    @CurrentUser() user: AuthUser,
    @Param('reservationId') reservationId: string,
  ) {
    return createApiResponse(
      await this.orders.getEligibility(user, reservationId),
    );
  }

  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateMaterialOrderDto,
  ) {
    return createApiResponse(
      await this.orders.create(user, dto),
      'Demande envoyee a la quincaillerie.',
    );
  }

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    return createApiResponse(await this.orders.list(user));
  }

  @Get(':id')
  async get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return createApiResponse(await this.orders.get(user, id));
  }

  @Get(':id/delivery-offer')
  async deliveryOffer(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return createApiResponse(await this.orders.getDeliveryOffer(user, id));
  }

  @Post(':id/delivery/accept')
  async acceptDelivery(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return createApiResponse(
      await this.orders.acceptDelivery(user, id),
      'Livraison de materiel acceptee.',
    );
  }

  @Patch(':id/validation')
  async validate(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ValidateMaterialOrderDto,
  ) {
    return createApiResponse(
      await this.orders.validate(user, id, dto),
      'Disponibilite du materiel mise a jour.',
    );
  }

  @Patch(':id/delivery-option')
  async configureDelivery(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ConfigureMaterialDeliveryDto,
  ) {
    return createApiResponse(
      await this.orders.configureDelivery(user, id, dto.deliveryRequested),
      dto.deliveryRequested
        ? 'Livraison ajoutee.'
        : 'Retrait en quincaillerie selectionne.',
    );
  }

  @Post(':id/payment')
  async initiatePayment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: InitiateMaterialOrderPaymentDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return createApiResponse(
      await this.payments.initiate(user, id, { ...dto, idempotencyKey }),
      'Paiement du materiel initialise.',
    );
  }

  @Post(':id/payment/mock-confirm')
  async confirmMockPayment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return createApiResponse(
      await this.payments.confirmMock(user, id),
      'Paiement du materiel confirme.',
    );
  }
}
