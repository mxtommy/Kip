import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { SettingsDatasetsComponent } from './settings-datasets.component';

describe('SettingsDatasetsComponent', () => {
  let component: SettingsDatasetsComponent;
  let fixture: ComponentFixture<SettingsDatasetsComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ SettingsDatasetsComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(SettingsDatasetsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});
