import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { SettingsUnitsComponent } from './settings-units.component';

describe('SettingsUnitsComponent', () => {
  let component: SettingsUnitsComponent;
  let fixture: ComponentFixture<SettingsUnitsComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ SettingsUnitsComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(SettingsUnitsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
