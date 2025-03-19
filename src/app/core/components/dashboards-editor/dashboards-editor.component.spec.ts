import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DashboardsEditorComponent } from './dashboards-editor.component';

describe('DashboardsManageComponent', () => {
  let component: DashboardsEditorComponent;
  let fixture: ComponentFixture<DashboardsEditorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardsEditorComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DashboardsEditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
