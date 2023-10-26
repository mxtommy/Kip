import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { SettingsTabsComponent } from './tabs.component';

describe('SettingsTabsComponent', () => {
  let component: SettingsTabsComponent;
  let fixture: ComponentFixture<SettingsTabsComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ SettingsTabsComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(SettingsTabsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});
