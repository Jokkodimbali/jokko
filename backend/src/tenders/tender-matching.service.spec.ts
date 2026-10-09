import { TenderMatchingService } from './tender-matching.service';
import { type SearchQueryService } from '../search/application/services/search-query.service';
it('reuses geographical catalogue search and excludes self and profiles without bookable services', async () => {
  const search = {
    searchProfessionals: jest.fn().mockResolvedValue({
      total: 4,
      items: [
        {
          id: 'self',
          userId: 'client',
          distanceKm: 1,
          services: [{ id: 'own' }],
        },
        { id: 'empty', userId: 'other', distanceKm: 2, services: [] },
        {
          id: 'unknown-location',
          userId: 'unknown',
          distanceKm: null,
          services: [{ id: 'service' }],
        },
        {
          id: 'pro',
          userId: 'pro-user',
          distanceKm: 3,
          services: [{ id: 'service' }],
        },
      ],
    }),
  };
  const matching = new TenderMatchingService(
    search as unknown as SearchQueryService,
  );
  const input = {
    categoryId: 'category',
    subCategoryId: 'specialty',
    latitude: 14.69,
    longitude: -17.46,
    radiusKm: 10,
    description: 'Réparer une fuite',
    address: 'Dakar',
    proposedPrice: 10000,
  };
  expect(await matching.findRecipients('client', input)).toEqual([
    {
      id: 'pro',
      userId: 'pro-user',
      distanceKm: 3,
      services: [{ id: 'service' }],
    },
  ]);
  expect(search.searchProfessionals).toHaveBeenCalledTimes(1);
  expect(search.searchProfessionals).toHaveBeenCalledWith(
    expect.objectContaining({
      role: 'PRESTATAIRE',
      categoryId: 'category',
      subCategoryId: 'specialty',
      latitude: 14.69,
      longitude: -17.46,
      radiusKm: 10,
      excludeStores: true,
      travelMode: 'PRESTATAIRE_SE_DEPLACE',
    }),
  );
});

it('invites eligible providers beyond the first result page', async () => {
  const search = {
    searchProfessionals: jest
      .fn()
      .mockImplementation(({ page }: { page: number }) =>
        Promise.resolve({
          total: 51,
          items:
            page === 1
              ? Array.from({ length: 50 }, (_, index) => ({
                  id: `pro-${index}`,
                  userId: `user-${index}`,
                  distanceKm: 4,
                  services: [{ id: 'service' }],
                }))
              : [
                  {
                    id: 'pro-50',
                    userId: 'user-50',
                    distanceKm: 5,
                    services: [{ id: 'service' }],
                  },
                ],
        }),
      ),
  };
  const matching = new TenderMatchingService(
    search as unknown as SearchQueryService,
  );
  const recipients = await matching.findRecipients('client', {
    categoryId: 'category',
    latitude: 14.69,
    longitude: -17.46,
    radiusKm: 25,
  } as never);
  expect(recipients).toHaveLength(51);
  expect(search.searchProfessionals).toHaveBeenCalledTimes(2);
});
