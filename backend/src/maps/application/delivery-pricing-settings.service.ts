import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type DeliveryPricingSettings = {
  pricePerKm: number;
  courierCommissionRate: number;
};

const DEFAULT_SETTINGS: DeliveryPricingSettings = {
  pricePerKm: 500,
  courierCommissionRate: 10,
};

@Injectable()
export class DeliveryPricingSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<DeliveryPricingSettings> {
    const hasUnifiedPriceColumn = await this.hasColumn('price_per_km');

    let rows: Array<{ pricePerKm: number; courierCommissionRate: number }>;

    if (hasUnifiedPriceColumn) {
      rows = await this.prisma.$queryRaw<Array<{
        pricePerKm: number;
        courierCommissionRate: number;
      }>>(Prisma.sql`
        SELECT price_per_km::float8 AS "pricePerKm",
               courier_commission_rate::float8 AS "courierCommissionRate"
        FROM delivery_pricing_settings WHERE id = 1
      `);
    } else {
      rows = await this.prisma.$queryRaw<Array<{
        pricePerKm: number;
        courierCommissionRate: number;
      }>>(Prisma.sql`
        SELECT COALESCE(pharmacy_price_per_km, material_price_per_km, 500)::float8 AS "pricePerKm",
               courier_commission_rate::float8 AS "courierCommissionRate"
        FROM delivery_pricing_settings WHERE id = 1
      `);
    }

    return rows[0] ?? DEFAULT_SETTINGS;
  }

  async update(input: DeliveryPricingSettings): Promise<DeliveryPricingSettings> {
    const value = this.normalize(input);
    const hasUnifiedPriceColumn = await this.hasColumn('price_per_km');

    if (hasUnifiedPriceColumn) {
      await this.prisma.$executeRaw(Prisma.sql`
        INSERT INTO delivery_pricing_settings
          (id, price_per_km, courier_commission_rate, updated_at)
        VALUES (1, ${value.pricePerKm}, ${value.courierCommissionRate}, NOW())
        ON CONFLICT (id) DO UPDATE SET
          price_per_km = EXCLUDED.price_per_km,
          courier_commission_rate = EXCLUDED.courier_commission_rate,
          updated_at = NOW()
      `);
      return value;
    }

    await this.prisma.$executeRaw(Prisma.sql`
      INSERT INTO delivery_pricing_settings
        (id, pharmacy_price_per_km, material_price_per_km, courier_commission_rate, updated_at)
      VALUES (1, ${value.pricePerKm}, ${value.pricePerKm}, ${value.courierCommissionRate}, NOW())
      ON CONFLICT (id) DO UPDATE SET
        pharmacy_price_per_km = EXCLUDED.pharmacy_price_per_km,
        material_price_per_km = EXCLUDED.material_price_per_km,
        courier_commission_rate = EXCLUDED.courier_commission_rate,
        updated_at = NOW()
    `);
    return value;
  }

  private async hasColumn(columnName: string): Promise<boolean> {
    const columns = await this.prisma.$queryRaw<Array<{ column_name: string }>>(Prisma.sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'delivery_pricing_settings'
        AND table_schema = current_schema()
    `);

    return columns.some((column) => column.column_name === columnName);
  }

  private normalize(input: DeliveryPricingSettings): DeliveryPricingSettings {
    const values = Object.entries(input) as Array<[keyof DeliveryPricingSettings, number]>;
    if (values.some(([, value]) => !Number.isFinite(value) || value < 0)) {
      throw new Error('Invalid delivery pricing settings');
    }
    if (input.courierCommissionRate > 100) throw new Error('Invalid commission rate');
    return {
      pricePerKm: Math.round(input.pricePerKm),
      courierCommissionRate: Number(input.courierCommissionRate.toFixed(2)),
    };
  }
}
