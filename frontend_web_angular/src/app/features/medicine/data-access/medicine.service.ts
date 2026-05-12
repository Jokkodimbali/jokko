import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/http/api-response.models';
import { unwrapApiResponse } from '../../../core/http/api-response.utils';
import { BackendProfessional, PaginationMeta } from '../../services/domain/models/services.models';
import { DoctorProfile } from '../domain/models/medicine.models';

@Injectable({
  providedIn: 'root',
})
export class MedicineService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  listDoctors(page: number = 1, limit: number = 12): Observable<{ doctors: DoctorProfile[]; meta?: PaginationMeta }> {
    return this.http
      .get<ApiResponse<BackendProfessional[]>>(`${this.apiUrl}/search/professionals`, {
        params: {
          query: 'medecin',
          page: page.toString(),
          limit: limit.toString(),
        },
      })
      .pipe(
        map((response) => ({
          doctors: unwrapApiResponse(response).map((professional) => this.mapDoctor(professional)),
          meta: response.meta?.['pagination'] as PaginationMeta | undefined,
        })),
      );
  }

  private mapDoctor(professional: BackendProfessional): DoctorProfile {
    const primaryService = professional.services[0];

    return {
      id: professional.id,
      name: professional.companyName || professional.name,
      specialty: primaryService?.name || primaryService?.categoryName || 'Consultation medicale',
      rating: professional.rating || 0,
      reviewCount: professional.totalReviews || 0,
      location: (professional.city || 'Dakar').toUpperCase(),
      latitude: professional.latitude,
      longitude: professional.longitude,
      imageUrl: professional.avatarUrl || '/medicine-doctor-charle-diouf.png',
      isOnline: false,
      nextAvailability: ['MER 15', 'Jeu 16', 'ven 17', 'Sam 18'],
      modes: ['Teleconsult', 'Cabinet'],
      availability: [
        {
          period: 'Prochaines dispos',
          days: ['MER 15', 'Jeu 16', 'ven 17', 'Sam 18'],
        },
      ],
    };
  }
}
