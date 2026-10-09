import { Injectable } from '@nestjs/common';
import { SearchQueryService } from '../search/application/services/search-query.service';
import { CreateTenderDto } from './tenders.dto';

@Injectable()
export class TenderMatchingService {
  constructor(private readonly search: SearchQueryService) {}

  async findRecipients(clientId: string, input: CreateTenderDto) {
    // The catalogue includes profiles without coordinates and paginates at 50.
    // Invitations require a measured distance, and must cover every page.
    const recipients = [] as Awaited<
      ReturnType<SearchQueryService['searchProfessionals']>
    >['items'];
    let page = 1;
    let total = 0;
    do {
      const result = await this.search.searchProfessionals({
        role: 'PRESTATAIRE',
        categoryId: input.categoryId,
        subCategoryId: input.subCategoryId,
        latitude: input.latitude,
        longitude: input.longitude,
        radiusKm: Math.min(input.radiusKm, 25),
        travelMode: 'PRESTATAIRE_SE_DEPLACE',
        excludeStores: true,
        page,
        limit: 50,
      });
      total = result.total;
      recipients.push(
        ...result.items.filter(
          (person) =>
            person.userId !== clientId &&
            person.services.length > 0 &&
            person.distanceKm !== null &&
            person.distanceKm !== undefined &&
            person.distanceKm <= 25,
        ),
      );
      page++;
    } while ((page - 1) * 50 < total);
    return [
      ...new Map(recipients.map((person) => [person.userId, person])).values(),
    ];
  }
}
