import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ValidationPipe } from '@nestjs/common';
import { CreateTenderDto, RespondTenderDto, TenderListDto } from './tenders.dto';
const valid = {
  categoryId: 'de3b3f2c-a5c3-40ad-9d69-0fca1d1a5156',
  description: 'Réparer une fuite dans la cuisine',
  address: 'Dakar, Mermoz',
  latitude: 14.69,
  longitude: -17.46,
  proposedPrice: 10000,
};
it('accepts a complete tender and supplies the search radius', async () => {
  const dto = plainToInstance(CreateTenderDto, valid);
  expect(await validate(dto)).toHaveLength(0);
  expect(dto.radiusKm).toBe(25);
});
it.each([
  { proposedPrice: -1 },
  { proposedPrice: 1.5 },
  { proposedPrice: 100000000 },
  { latitude: 95 },
  { description: ' ' },
  { address: ' ' },
  { radiusKm: 101 },
  { scheduledAt: 'yesterday' },
])('rejects malformed requests: %j', async (input) => {
  expect(
    await validate(plainToInstance(CreateTenderDto, { ...valid, ...input })),
  ).not.toHaveLength(0);
});
it('requires a revision and an existing service identifier when responding', async () => {
  expect(
    await validate(plainToInstance(RespondTenderDto, { amount: 12000 })),
  ).not.toHaveLength(0);
});

it('accepts the answeredOnly query sent by the client under the API validation pipe', async () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
    transform: true,
  });
  const query = await pipe.transform(
    { page: '1', answeredOnly: 'true' },
    { type: 'query', metatype: TenderListDto },
  );
  expect(query).toMatchObject({ page: 1, answeredOnly: true });
});
