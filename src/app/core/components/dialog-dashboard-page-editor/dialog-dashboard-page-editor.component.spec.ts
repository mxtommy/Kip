import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DialogDashboardPageEditorComponent } from './dialog-dashboard-page-editor.component';

describe('DialogDashboardPageEditorComponent', () => {
  let component: DialogDashboardPageEditorComponent;
  let fixture: ComponentFixture<DialogDashboardPageEditorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DialogDashboardPageEditorComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DialogDashboardPageEditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
