import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { SettingsDerivedComponent } from './settings-derived.component';

describe('SettingsDerivedComponent', () => {
  let component: SettingsDerivedComponent;
  let fixture: ComponentFixture<SettingsDerivedComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ SettingsDerivedComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(SettingsDerivedComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});
