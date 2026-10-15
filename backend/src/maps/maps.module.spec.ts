import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { AutocompleteAddressesUseCase } from '../geolocation/application/use-cases/autocomplete-addresses.use-case';
import { MapsController } from './presentation/maps.controller';
import { MapsModule } from './maps.module';

describe('MapsModule dependency graph', () => {
  it('resolves the controller through the provider-neutral address use case', async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ MAP_PROVIDER: 'geoapify', JWT_ACCESS_SECRET: 'test-secret' })],
        }),
        MapsModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    expect(module.get(MapsController)).toBeInstanceOf(MapsController);
    expect(module.get(AutocompleteAddressesUseCase)).toBeInstanceOf(AutocompleteAddressesUseCase);
    await module.close();
  });
});
