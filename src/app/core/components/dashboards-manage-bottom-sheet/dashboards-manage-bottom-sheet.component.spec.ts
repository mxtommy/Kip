import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DashboardsManageBottomSheetComponent } from './dashboards-manage-bottom-sheet.component';

describe('DashboardsManageBottomSheetComponent', () => {
  let component: DashboardsManageBottomSheetComponent;
  let fixture: ComponentFixture<DashboardsManageBottomSheetComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardsManageBottomSheetComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DashboardsManageBottomSheetComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
