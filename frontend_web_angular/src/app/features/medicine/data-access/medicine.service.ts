import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/http/api-response.models';
import { unwrapApiResponse } from '../../../core/http/api-response.utils';
import {
  BackendProfessional,
  BackendProfessionalAvailability,
  PaginationMeta,
} from '../../services/domain/models/services.models';
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
        switchMap((response) => {
          const professionals = unwrapApiResponse(response);
          if (professionals.length === 0) {
            return of({
              doctors: [],
              meta: response.meta?.['pagination'] as PaginationMeta | undefined,
            });
          }

          return forkJoin(
            professionals.map((professional) =>
              this.getProfessionalAvailabilities(professional.id).pipe(
                map((availabilities) => this.mapDoctor(professional, availabilities)),
                catchError(() => of(this.mapDoctor(professional, []))),
              ),
            ),
          ).pipe(
            map((doctors) => ({
              doctors,
              meta: response.meta?.['pagination'] as PaginationMeta | undefined,
            })),
          );
        }),
      );
  }

  private getProfessionalAvailabilities(profileId: string): Observable<BackendProfessionalAvailability[]> {
    return this.http
      .get<ApiResponse<BackendProfessionalAvailability[]>>(
        `${this.apiUrl}/professionals/${profileId}/availabilities`,
      )
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  private mapDoctor(
    professional: BackendProfessional,
    availabilities: BackendProfessionalAvailability[],
  ): DoctorProfile {
    const primaryService = professional.services[0];
    const nextAvailability = this.buildNextAvailabilityLabels(availabilities);

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
      nextAvailability,
      modes: ['Teleconsult', 'Cabinet'],
      availability: [
        {
          period: 'Prochaines dispos',
          days: nextAvailability,
        },
      ],
    };
  }

  private buildNextAvailabilityLabels(availabilities: BackendProfessionalAvailability[]): string[] {
    const activeWeekdays = new Set(
      availabilities
        .filter((availability) => availability.estActive)
        .map((availability) => availability.jourSemaine),
    );

    if (activeWeekdays.size === 0) {
      return [];
    }

    const formatter = new Intl.DateTimeFormat('fr-FR', {
      weekday: 'short',
      day: 'numeric',
    });
    const labels: string[] = [];
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);

    for (let offset = 0; offset < 21 && labels.length < 4; offset += 1) {
      const date = new Date(cursor);
      date.setDate(cursor.getDate() + offset);

      if (!activeWeekdays.has(date.getDay())) {
        continue;
      }

      labels.push(
        formatter
          .format(date)
          .replace('.', '')
          .replace(/^\p{L}/u, (letter) => letter.toUpperCase()),
      );
    }

    return labels;
  }
}
