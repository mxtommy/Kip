import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DashboardEditorComponent } from './dashboard-editor.component';

describe('DashboardEditorComponent', () => {
  let component: DashboardEditorComponent;
  let fixture: ComponentFixture<DashboardEditorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardEditorComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DashboardEditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
