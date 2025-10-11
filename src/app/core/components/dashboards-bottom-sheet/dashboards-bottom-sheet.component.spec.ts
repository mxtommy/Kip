import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DashboardsBottomSheetComponent } from './dashboards-bottom-sheet.component';

describe('DashboardsBottomSheetComponent', () => {
  let component: DashboardsBottomSheetComponent;
  let fixture: ComponentFixture<DashboardsBottomSheetComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardsBottomSheetComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DashboardsBottomSheetComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
