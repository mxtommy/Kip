import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SimpleDataChartComponent } from './simple-data-chart.component';

describe('SimpleDataChartComponent', () => {
  let component: SimpleDataChartComponent;
  let fixture: ComponentFixture<SimpleDataChartComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SimpleDataChartComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SimpleDataChartComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
