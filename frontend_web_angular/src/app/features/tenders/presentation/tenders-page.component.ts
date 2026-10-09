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
  protected readonly labels = TENDER_STATUS_LABELS;
  protected readonly asset = publicAssetUrl;
  protected counterTenderId = '';
  protected counterPrice = 10000;
  protected counterServiceId = '';
  protected get providerOnline() {
    return this.presence.isOnline(this.auth.currentUser()?.id);
  }
  protected openCounter(tender: Tender) {
    this.counterTenderId = tender.id;
    this.counterPrice = tender.responses[0]?.status === 'REJECTED' && tender.responses[0].amount
      ? tender.responses[0].amount
      : Math.min(99999999, tender.proposedPrice + 1000);
    this.counterServiceId = tender.responses[0]?.serviceId ?? tender.responses[0]?.services[0]?.id ?? '';
  }
  protected closeCounter() { this.counterTenderId = ''; }
  protected respondTo(tender: Tender, amount: number, serviceId?: string) {
    const chosenService = serviceId ?? tender.responses[0]?.serviceId ?? tender.responses[0]?.services[0]?.id;
    if (!chosenService) return;
    this.actFor(tender, {
      kind: 'respond', amount, serviceId: chosenService,
    });
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
