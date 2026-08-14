import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  BackendProfessionalAvailability,
  BackendProfessionalDetailService,
  BackendProfessionalPortfolioItem,
  BackendProfessionalProfile,
  CategoryStructure,
} from '../../services/domain/models/services.models';
import {
  NegotiationView,
  ServiceProposalService,
} from '../../services/data-access/service-proposal.service';
import { BackendReservation } from '../../appointments/domain/appointments.models';
import { DoctorSpaceService, DoctorWalletView } from './doctor-space.service';

export type DoctorSpaceSectionKey =
  | 'profile'
  | 'availability'
  | 'consultation'
  | 'negotiations'
  | 'patient-appointments'
  | 'agenda'
  | 'medical-history'
  | 'wallet';

export interface DoctorSpaceSectionData {
  availabilities?: BackendProfessionalAvailability[];
  services?: BackendProfessionalDetailService[];
  categories?: CategoryStructure[];
  reservations?: BackendReservation[];
  negotiations?: NegotiationView[];
  wallet?: DoctorWalletView | null;
  portfolio?: BackendProfessionalPortfolioItem[];
}

/** Charge uniquement les donnees necessaires a la section visible. */
@Injectable({ providedIn: 'root' })
export class DoctorSpaceSectionLoaderService {
  private readonly doctorSpaceService = inject(DoctorSpaceService);
  private readonly proposalService = inject(ServiceProposalService);

  load(
    section: DoctorSpaceSectionKey,
    profile: BackendProfessionalProfile | null,
    isProviderSpace: boolean,
  ): Observable<DoctorSpaceSectionData> {
    switch (section) {
      case 'availability':
        return forkJoin({
          availabilities: this.safe(this.doctorSpaceService.listMyAvailabilities(), []),
          // Le formulaire de disponibilite permet aussi de modifier le mode
          // commun aux services: ces services font donc partie des donnees
          // requises par cette section.
          services: this.safe(this.doctorSpaceService.listMyServices(), []),
        });
      case 'consultation':
        return forkJoin({
          services: this.safe(this.doctorSpaceService.listMyServices(), []),
          categories: this.safe(this.doctorSpaceService.listCategoryStructure(), []),
          portfolio:
            profile?.statutKyc === 'VERIFIE'
              ? this.safe(this.doctorSpaceService.listPortfolio(profile.id), [])
              : of([]),
        });
      case 'negotiations':
        return forkJoin({
          reservations: this.safe(this.doctorSpaceService.listMyReservations(), []),
          negotiations: isProviderSpace
            ? this.safe(this.proposalService.listMyPriceProposals('PRESTATAIRE'), [])
            : of([]),
        });
      case 'patient-appointments':
      case 'medical-history':
        return forkJoin({
          reservations: this.safe(this.doctorSpaceService.listMyReservations(), []),
        });
      case 'agenda':
        return forkJoin({
          reservations: this.safe(this.doctorSpaceService.listMyReservations(), []),
          availabilities: this.safe(this.doctorSpaceService.listMyAvailabilities(), []),
        });
      case 'wallet':
        return forkJoin({
          wallet: this.safe(this.doctorSpaceService.getWallet(), null),
        });
      case 'profile':
      default:
        return of({});
    }
  }

  private safe<T>(request: Observable<T>, fallback: T): Observable<T> {
    return request.pipe(catchError(() => of(fallback)));
  }
}
