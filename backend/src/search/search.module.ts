import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SEARCH_REPOSITORY_PORT } from './application/ports/search-repository.port';
import { SearchQueryService } from './application/services/search-query.service';
import { SearchRepository } from './infrastructure/repositories/search.repository';
import { SearchController } from './presentation/controllers/search.controller';

@Module({
  imports: [PrismaModule],
  controllers: [SearchController],
  providers: [
    SearchRepository,
    {
      provide: SEARCH_REPOSITORY_PORT,
      useExisting: SearchRepository,
    },
    SearchQueryService,
  ],
  exports: [SearchQueryService],
})
export class SearchModule {}
