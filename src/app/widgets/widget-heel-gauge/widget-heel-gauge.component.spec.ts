import { TestBed } from '@angular/core/testing';
import { WidgetHeelGaugeComponent } from './widget-heel-gauge.component';

describe('WidgetHeelGaugeComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WidgetHeelGaugeComponent]
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(WidgetHeelGaugeComponent);
    const comp = fixture.componentInstance;
    expect(comp).toBeTruthy();
  });
});
