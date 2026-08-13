import { Observable, Subject, Subscription, switchMap, timeout } from 'rxjs';

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
          new Observable<RouteRecalculationResult<TInput, TResult>>((subscriber) => {
            const inner = this.execute(request.input)
              .pipe(timeout({ first: this.timeoutMs }))
              .subscribe({
                next: (result) => subscriber.next({ request, result }),
                error: (error: unknown) => {
                  subscriber.next({ request, error });
                  subscriber.complete();
                },
                complete: () => subscriber.complete(),
              });
            return () => inner.unsubscribe();
          }),
        ),
      )
      .subscribe((result) => {
        if (result.request.generation !== this.generation) return;
        this.onResult(result);
      });
  }

  request(input: TInput, origin: { lat: number; lng: number }, nowMs = Date.now()): number {
    this.start();
    const generation = ++this.generation;
    this.requests.next({ generation, requestedAtMs: nowMs, origin, input });
    return generation;
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
