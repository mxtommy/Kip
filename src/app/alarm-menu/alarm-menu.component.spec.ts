import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { AlarmMenuComponent } from './alarm-menu.component';

describe('AlarmMenuComponent', () => {
  let component: AlarmMenuComponent;
  let fixture: ComponentFixture<AlarmMenuComponent>;

  beforeEach(async(() => {
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
