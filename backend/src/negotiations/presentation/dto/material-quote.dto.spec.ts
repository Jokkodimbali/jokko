import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateReservationMaterialListDto } from './material-quote.dto';

it.each(
  [
    [],
    [{ designation: ' ', quantity: 1, unitPrice: 0 }],
    [{ designation: 'PVC', quantity: 0, unitPrice: 0 }],
    [{ designation: 'PVC', quantity: 1.5, unitPrice: 0 }],
    Array.from({ length: 51 }, () => ({
      designation: 'PVC',
      quantity: 1,
      unitPrice: 0,
    })),
  ].map((items) => ({ items })),
)('rejects an invalid material list', async ({ items }) => {
  expect(
    await validate(
      plainToInstance(CreateReservationMaterialListDto, { items }),
    ),
  ).not.toHaveLength(0);
});

it('accepts a material list without any negotiation or price change', async () => {
  const dto = plainToInstance(CreateReservationMaterialListDto, {
    items: [{ designation: 'PVC', quantity: 2, unitPrice: 0 }],
  });
  expect(await validate(dto)).toHaveLength(0);
});
