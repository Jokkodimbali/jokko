import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { MaterialQuoteSummaryCardComponent } from './material-quote-summary-card.component';

describe('MaterialQuoteSummaryCardComponent', () => {
  let fixture: ComponentFixture<MaterialQuoteSummaryCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MaterialQuoteSummaryCardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MaterialQuoteSummaryCardComponent);
  });

  afterEach(() => {
    fixture?.destroy();
    TestBed.resetTestingModule();
  });

  it('clears attention after the timeout without producing a change-detection error', fakeAsync(() => {
    fixture.componentInstance.items = [{ designation: 'Masque de protection', quantity: 2 }];

    fixture.detectChanges();
    expect(fixture.componentInstance['attentionActive']).toBe(true);

    tick(10_000);
    fixture.detectChanges();

    expect(() => fixture.checkNoChanges()).not.toThrow();
    expect(fixture.componentInstance['attentionActive']).toBe(false);
  }));
});
