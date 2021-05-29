import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { UnitWindowComponent } from './unit-window.component';

describe('UnitWindowComponent', () => {
  let component: UnitWindowComponent;
  let fixture: ComponentFixture<UnitWindowComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ UnitWindowComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(UnitWindowComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});
