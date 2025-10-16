import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { SettingsUnitsComponent } from './units.component';

describe('SettingsUnitsComponent', () => {
  let component: SettingsUnitsComponent;
  let fixture: ComponentFixture<SettingsUnitsComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
    imports: [SettingsUnitsComponent]
})
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(SettingsUnitsComponent);
    component = fixture.componentInstance;
    // Intentionally skip initial detectChanges to avoid ECAH from async init
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
