import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  BehaviorSubject,
  Observable,
  EMPTY,
  Subject,
  catchError,
  exhaustMap,
  filter,
  finalize,
  merge,
  of,
  switchMap,
  timer,
} from 'rxjs';
import { LucideAngularModule } from 'lucide-angular';
import { AuthSessionService } from '../../../core/auth/auth-session.service';
import { getHttpErrorMessage } from '../../../core/http/api-response.utils';
import { MessagesRealtimeService } from '../../messages/data-access/messages-realtime.service';
import { TendersService } from '../data-access/tenders.service';
import {
  CreateTender,
  Tender,
  TenderAction,
  TenderList,
  TENDER_STATUS_LABELS,
} from '../data-access/tenders.models';
import { TenderComposerComponent, type TenderAudience } from './tender-composer.component';
import { TenderDetailComponent } from './tender-detail.component';
import { publicAssetUrl } from '../../../shared/utils/public-asset-url';
import { SessionPresenceService } from '../../../core/presence/session-presence.service';
import { TenderPriceControlComponent } from './tender-price-control.component';
import { ServiceProposalService } from '../../services/data-access/service-proposal.service';
import { normalizeSearchText } from '../../../shared/utils/normalize-search-text';
@Component({
  selector: 'app-tenders-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    LucideAngularModule,
    TenderComposerComponent,
    TenderDetailComponent,
    TenderPriceControlComponent,
  ],
  templateUrl: './tenders-page.component.html',
  styleUrls: ['./tenders.shared.scss', './tenders-page.component.scss'],
})
export class TendersPageComponent {
  private readonly api = inject(TendersService);
  private readonly reservations = inject(ServiceProposalService);
  private readonly auth = inject(AuthSessionService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly realtime = inject(MessagesRealtimeService);
  private readonly presence = inject(SessionPresenceService);
  private readonly refresh = new Subject<void>();
  private readonly context = new BehaviorSubject<{ id: string; page: number }>({ id: '', page: 1 });
  protected readonly isClient = computed(() => this.auth.currentUser()?.role === 'CLIENT');
  protected readonly selected = signal<Tender | null>(null);
  protected readonly list = signal<TenderList>({ items: [], total: 0, page: 1, limit: 20 });
  protected readonly audience = signal<TenderAudience | null>(null);
  protected readonly detailId = signal('');
  protected readonly busy = signal(false);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly reservationError = signal('');
  protected readonly labels = TENDER_STATUS_LABELS;
  protected readonly asset = publicAssetUrl;
  protected counterTenderId = '';
  protected counterPrice = 10000;
  protected counterServiceId = '';
  protected get providerOnline() {
    return this.presence.isOnline(this.auth.currentUser()?.id);
  }
  protected providerSubtitle(): string {
    const user = this.auth.currentUser();
    const details = [user?.professionalProfile?.categories?.[0], user?.professionalProfile?.ville || user?.address]
      .filter((value): value is string => Boolean(value?.trim()));
    return details.join(' · ') || 'Profil professionnel';
  }
  protected relativeTime(date: string): string {
    const elapsedMinutes = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60_000));
    if (!Number.isFinite(elapsedMinutes)) return '';
    if (elapsedMinutes < 1) return 'à l’instant';
    if (elapsedMinutes < 60) return `il y a ${elapsedMinutes} min`;
    const hours = Math.floor(elapsedMinutes / 60);
    if (hours < 24) return `il y a ${hours} h`;
    return `il y a ${Math.floor(hours / 24)} j`;
  }
  protected openCounter(tender: Tender) {
    this.counterTenderId = tender.id;
    this.counterPrice = tender.responses[0]?.status === 'REJECTED' && tender.responses[0].amount
      ? tender.responses[0].amount
      : Math.min(99999999, tender.proposedPrice + 1000);
    this.counterServiceId = this.serviceFor(tender);
  }
  protected closeCounter() { this.counterTenderId = ''; }
  protected respondTo(tender: Tender, amount: number, serviceId?: string) {
    const chosenService = serviceId ?? this.serviceFor(tender);
    if (!chosenService) return;
    this.actFor(tender, {
      kind: 'respond', amount, serviceId: chosenService,
    });
  }
  protected serviceFor(tender: Tender): string {
    const response = tender.responses[0];
    if (!response) return '';
    const services = response.services;
    if (response.serviceId && services.some((service) => service.id === response.serviceId)) {
      return response.serviceId;
    }
    const job = normalizeSearchText(tender.job);
    return services.find((service) => normalizeSearchText(service.name) === job)?.id
      ?? services[0]?.id
      ?? '';
  }
  protected providerStatusLabel(tender: Tender): string {
    return tender.status === 'CANCELLED'
      ? this.labels.CANCELLED
      : this.labels[tender.responses[0]?.status ?? 'INVITED'];
  }
  protected clientOffers(tender: Tender) {
    return tender.responses.filter(
      (response) => response.status === 'OFFERED' || response.status === 'SELECTED',
    );
  }
  protected initials(name: string) {
    return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  }
  protected readonly pending = computed(() =>
    this.list().items.filter(
      (item) => item.status === 'OPEN' && item.responses[0]?.status === 'INVITED',
    ),
  );
  protected readonly sent = computed(() =>
    this.list().items.filter(
      (item) => !(item.status === 'OPEN' && item.responses[0]?.status === 'INVITED'),
    ),
  );
  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const id = params.get('id') ?? '';
      this.detailId.set(id);
      this.selected.set(null);
      this.reservationError.set('');
      this.loading.set(true);
      this.context.next({ id, page: 1 });
    });
    this.context
      .pipe(
        switchMap((context) =>
          merge(
            timer(0, 5000),
            this.refresh,
            this.realtime.notificationCreated$.pipe(
              filter(
                (notification) => !!(notification.data || notification.donnees || {})['tenderId'],
              ),
            ),
          ).pipe(
            exhaustMap(() =>
              this.loadContext(context).pipe(
                catchError((error) => {
                  this.error.set(
                    getHttpErrorMessage(error, 'Impossible de charger les appels d’offres.'),
                  );
                  this.loading.set(false);
                  return EMPTY;
                }),
              ),
            ),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((result) => {
        if ('items' in result) this.list.set(result);
        else this.selected.set(result);
        this.loading.set(false);
      });
  }
  private loadContext(context: { id: string; page: number }): Observable<Tender | TenderList> {
    return context.id ? this.api.detail(context.id) : this.api.list(context.page, this.isClient());
  }
  protected retry() {
    this.error.set('');
    this.refresh.next();
  }
  protected changePage(delta: number) {
    const page = this.list().page + delta;
    this.loading.set(true);
    this.context.next({ id: '', page });
  }
  protected publish(input: CreateTender) {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.api
      .create(input)
      .pipe(
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (tender) => void this.router.navigate(['/appels-offres', tender.id]),
        error: (error) =>
          this.error.set(getHttpErrorMessage(error, 'Impossible de publier la demande.')),
      });
  }
  protected act(action: TenderAction) {
    const tender = this.selected();
    if (tender) this.actFor(tender, action);
  }
  protected finalizeTenderOffer(
    tender: Tender,
    input: { responseId: string; appointmentDate: string; durationMinutes: number },
  ) {
    if (this.busy()) return;
    const chosen = tender.responses.find((response) => response.id === input.responseId);
    const duration = input.durationMinutes;
    const appointmentTime = new Date(input.appointmentDate).getTime();
    if (
      !chosen?.serviceId ||
      !chosen.amount ||
      !Number.isInteger(duration) ||
      duration < 5 ||
      duration > 1440 ||
      !tender.address.trim() ||
      !Number.isFinite(appointmentTime) ||
      appointmentTime <= Date.now()
    ) {
      this.reservationError.set('Les informations de cette offre ont changé. Vérifiez la date et le service avant de réessayer.');
      return;
    }
    this.busy.set(true);
    this.reservationError.set('');
    const selectedTender$ =
      tender.status === 'SELECTED'
        ? of(tender)
        : this.api.act(tender, { kind: 'select', responseId: chosen.id, amount: chosen.amount });
    selectedTender$
      .pipe(
        switchMap((updated) => {
          if (this.detailId() === tender.id) this.selected.set(updated);
          const offer = updated.responses.find(
            (response) => response.id === chosen.id && response.status === 'SELECTED',
          );
          if (!offer) throw new Error('L’offre choisie n’est plus disponible. Actualisez la demande.');
          if (offer.reservationId) return of({ id: offer.reservationId });
          if (!offer.negotiationId) {
            throw new Error('La réservation ne peut pas être créée pour cette offre.');
          }
          return this.reservations.createReservationFromNegotiation({
            negotiationId: offer.negotiationId,
            dateHeure: input.appointmentDate,
            adresseClient: updated.address,
            clientLatitude: updated.latitude,
            clientLongitude: updated.longitude,
            dureeMinutes: duration,
            notes: updated.description.slice(0, 1000),
          });
        }),
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (reservation) => {
          this.refresh.next();
          void this.router.navigate(['/appointments', reservation.id, 'payment'], {
            queryParams: { returnUrl: '/appointments', providerName: chosen.name },
          });
        },
        error: (error) => {
          this.reservationError.set(
            getHttpErrorMessage(error, 'Impossible de créer la réservation. Réessayez.'),
          );
          this.refresh.next();
        },
      });
  }
  protected actFor(tender: Tender, action: TenderAction) {
    if (!tender || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.api
      .act(tender, action)
      .pipe(
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (updated) => {
          if (this.detailId() === tender.id) this.selected.set(updated);
          this.counterTenderId = '';
          this.refresh.next();
          if (action.kind === 'cancel') {
            void this.router.navigate(['/appels-offres']);
          }
        },
        error: (error) => {
          this.error.set(getHttpErrorMessage(error, 'Impossible d’enregistrer cette action.'));
          this.refresh.next();
        },
      });
  }
}
