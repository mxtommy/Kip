import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { SettingsResetComponent } from './reset.component';

describe('SettingsResetComponent', () => {
  let component: SettingsResetComponent;
  let fixture: ComponentFixture<SettingsResetComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
    imports: [SettingsResetComponent]
})
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(SettingsResetComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});
