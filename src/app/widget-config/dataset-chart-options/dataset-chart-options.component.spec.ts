import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DatasetChartOptionsComponent } from './dataset-chart-options.component';

describe('DatasetChartOptionsComponent', () => {
  let component: DatasetChartOptionsComponent;
  let fixture: ComponentFixture<DatasetChartOptionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DatasetChartOptionsComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(DatasetChartOptionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
