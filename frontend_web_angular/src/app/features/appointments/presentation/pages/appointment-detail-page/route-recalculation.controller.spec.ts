import { Observable, Subject, of } from 'rxjs';
import { RouteRecalculationController } from './route-recalculation.controller';

describe('RouteRecalculationController', () => {
  it('cancels the active request and applies only the latest generation', () => {
    const streams = new Map<number, Subject<string>>();
    const cancelled: number[] = [];
    const results: string[] = [];
    const controller = new RouteRecalculationController<number, string>(
      (input) =>
        new Observable((subscriber) => {
          const stream = new Subject<string>();
          streams.set(input, stream);
          const subscription = stream.subscribe(subscriber);
          return () => {
            cancelled.push(input);
            subscription.unsubscribe();
          };
        }),
      (result) => {
        if ('result' in result) results.push(result.result);
      },
      5_000,
    );

    controller.request(1, { lat: 0, lng: 0 });
    controller.request(2, { lat: 0, lng: 0.001 });
    streams.get(1)?.next('obsolete');
    streams.get(2)?.next('latest');

    expect(cancelled).toContain(1);
    expect(results).toEqual(['latest']);
    expect(controller.currentGeneration()).toBe(2);
    controller.destroy();
  });

  it('allows context registration before a synchronous result is dispatched', () => {
    const contexts = new Map<number, string>();
    const applied: string[] = [];
    const controller = new RouteRecalculationController<number, string>(
      () => of('synchronous'),
      ({ request }) => applied.push(contexts.get(request.generation) ?? 'missing'),
      5_000,
    );

    const request = controller.reserve(1, { lat: 0, lng: 0 });
    contexts.set(request.generation, 'registered');
    controller.dispatch(request);

    expect(applied).toEqual(['registered']);
    controller.destroy();
  });

  it('turns an empty completion into a terminal error result', () => {
    const outcomes: string[] = [];
    const controller = new RouteRecalculationController<number, string>(
      () => new Observable((subscriber) => subscriber.complete()),
      (outcome) => outcomes.push('error' in outcome ? 'error' : 'result'),
      5_000,
    );

    controller.request(1, { lat: 0, lng: 0 });

    expect(outcomes).toEqual(['error']);
    controller.destroy();
  });
});
