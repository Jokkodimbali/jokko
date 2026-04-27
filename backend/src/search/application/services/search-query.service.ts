import { Inject, Injectable } from '@nestjs/common';
import { appMessage } from '../../../core/http/app-http.exception';
import { ValidationError } from '../../../shared/domain/errors/domain-error';
import {
  SEARCH_REPOSITORY_PORT,
  type SearchProfessionalsInput,
  type SearchProfessionalsResult,
  type SearchRepositoryPort,
} from '../ports/search-repository.port';

@Injectable()
export class SearchQueryService {
  constructor(
    @Inject(SEARCH_REPOSITORY_PORT)
    private readonly searchRepository: SearchRepositoryPort,
  ) {}

  async searchProfessionals(
    input: SearchProfessionalsInput,
  ): Promise<SearchProfessionalsResult> {
    const hasLatitude = input.latitude !== undefined;
    const hasLongitude = input.longitude !== undefined;

    if (hasLatitude !== hasLongitude) {
      const message = appMessage('SEARCH_COORDINATES_PAIR_REQUIRED');
      throw new ValidationError(message.code, message.message);
    }

    return this.searchRepository.searchProfessionals(input);
  }
}
