import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { SettingsDatasetsComponent } from './datasets.component';

describe('SettingsDatasetsComponent', () => {
  let component: SettingsDatasetsComponent;
  let fixture: ComponentFixture<SettingsDatasetsComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
    imports: [SettingsDatasetsComponent]
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
