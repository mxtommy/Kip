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
    // Provide required inputs before first detectChanges
    fixture.componentRef.setInput('dashboards', [
      { id: '1', name: 'Test Dashboard', icon: 'dashboard-dashboard', collapseSplitShell: false, configuration: [] }
    ]);
    fixture.componentRef.setInput('activePage', 0);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
