import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { SvgWindComponent } from './svg-wind.component';

describe('SvgWindComponent', () => {
  let component: SvgWindComponent;
  let fixture: ComponentFixture<SvgWindComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ SvgWindComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(SvgWindComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});
