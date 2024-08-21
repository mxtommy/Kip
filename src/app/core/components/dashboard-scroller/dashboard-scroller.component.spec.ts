import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DashboardScrollerComponent } from './dashboard-scroller.component';

describe('DashboardScrollerComponent', () => {
  let component: DashboardScrollerComponent;
  let fixture: ComponentFixture<DashboardScrollerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardScrollerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DashboardScrollerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
