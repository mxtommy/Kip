import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { SettingsSignalkComponent } from './settings-signalk.component';

describe('SettingsSignalkComponent', () => {
  let component: SettingsSignalkComponent;
  let fixture: ComponentFixture<SettingsSignalkComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ SettingsSignalkComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(SettingsSignalkComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});
