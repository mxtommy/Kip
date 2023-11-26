import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { AlarmMenuComponent } from './alarm-menu.component';

describe('AlarmMenuComponent', () => {
  let component: AlarmMenuComponent;
  let fixture: ComponentFixture<AlarmMenuComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ AlarmMenuComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(AlarmMenuComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
