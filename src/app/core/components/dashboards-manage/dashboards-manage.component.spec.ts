import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DashboardsManageComponent } from './dashboards-manage.component';

describe('DashboardsManageComponent', () => {
  let component: DashboardsManageComponent;
  let fixture: ComponentFixture<DashboardsManageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardsManageComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DashboardsManageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
