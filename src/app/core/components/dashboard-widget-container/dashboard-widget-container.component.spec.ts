import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DashboardWidgetContainerComponent } from './dashboard-widget-container.component';

describe('DashboardWidgetContainerComponent', () => {
  let component: DashboardWidgetContainerComponent;
  let fixture: ComponentFixture<DashboardWidgetContainerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardWidgetContainerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DashboardWidgetContainerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
