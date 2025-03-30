import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AppHelpComponent } from './app-help.component';

describe('AppHelpComponent', () => {
  let component: AppHelpComponent;
  let fixture: ComponentFixture<AppHelpComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppHelpComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AppHelpComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
