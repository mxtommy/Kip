import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { UnitWindowComponent } from './unit-window.component';

describe('UnitWindowComponent', () => {
  let component: UnitWindowComponent;
  let fixture: ComponentFixture<UnitWindowComponent>;

  beforeEach(async(() => {
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
