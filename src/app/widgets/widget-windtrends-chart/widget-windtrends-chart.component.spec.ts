import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WidgetWindTrendsChartComponent } from './widget-windtrends-chart.component';

describe('WidgetWindTrendsChartComponent', () => {
  let component: WidgetWindTrendsChartComponent;
  let fixture: ComponentFixture<WidgetWindTrendsChartComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WidgetWindTrendsChartComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WidgetWindTrendsChartComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
