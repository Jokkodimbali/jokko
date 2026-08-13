import { Observable, Subject } from 'rxjs';
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
});
