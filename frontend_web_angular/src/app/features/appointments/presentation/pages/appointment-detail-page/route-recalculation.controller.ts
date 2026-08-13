import { Observable, Subject, Subscription, catchError, defaultIfEmpty, map, of, switchMap, timeout } from 'rxjs';

export type RouteRecalculationRequest<TInput> = {
  generation: number;
  requestedAtMs: number;
  origin: { lat: number; lng: number };
  input: TInput;
};

export type RouteRecalculationResult<TInput, TResult> =
  | { request: RouteRecalculationRequest<TInput>; result: TResult }
  | { request: RouteRecalculationRequest<TInput>; error: unknown };

export class RouteRecalculationController<TInput, TResult> {
  private readonly requests = new Subject<RouteRecalculationRequest<TInput>>();
  private generation = 0;
  private subscription: Subscription | null = null;

  constructor(
    private readonly execute: (input: TInput) => Observable<TResult>,
    private readonly onResult: (result: RouteRecalculationResult<TInput, TResult>) => void,
    private readonly timeoutMs: number,
  ) {}

  start(): void {
    if (this.subscription) return;
    this.subscription = this.requests
      .pipe(
        switchMap((request) =>
          this.execute(request.input).pipe(
            timeout({ first: this.timeoutMs }),
            map((result) => ({ request, result }) as RouteRecalculationResult<TInput, TResult>),
            defaultIfEmpty({ request, error: new Error('EMPTY_ROUTE_RESULT') }),
            catchError((error: unknown) => of({ request, error })),
          ),
        ),
      )
      .subscribe((result) => {
        if (result.request.generation !== this.generation) return;
        this.onResult(result);
      });
  }

  request(input: TInput, origin: { lat: number; lng: number }, nowMs = Date.now()): number {
    const request = this.reserve(input, origin, nowMs);
    this.dispatch(request);
    return request.generation;
  }

  reserve(
    input: TInput,
    origin: { lat: number; lng: number },
    nowMs = Date.now(),
  ): RouteRecalculationRequest<TInput> {
    this.start();
    const generation = ++this.generation;
    return { generation, requestedAtMs: nowMs, origin, input };
  }

  dispatch(request: RouteRecalculationRequest<TInput>): void {
    if (request.generation !== this.generation) return;
    this.requests.next(request);
  }

  currentGeneration(): number {
    return this.generation;
  }

  destroy(): void {
    this.subscription?.unsubscribe();
    this.subscription = null;
    this.requests.complete();
  }
}
