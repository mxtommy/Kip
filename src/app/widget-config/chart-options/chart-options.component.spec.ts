import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChartOptionsComponent } from './chart-options.component';

describe('ChartOptionsComponent', () => {
  let component: ChartOptionsComponent;
  let fixture: ComponentFixture<ChartOptionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChartOptionsComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ChartOptionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
