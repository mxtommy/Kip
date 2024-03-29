import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DisplayChartOptionsComponent } from './display-chart-options.component';

describe('ChartOptionsComponent', () => {
  let component: DisplayChartOptionsComponent;
  let fixture: ComponentFixture<DisplayChartOptionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DisplayChartOptionsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DisplayChartOptionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
