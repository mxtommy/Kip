import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { SvgSimpleLinearGaugeComponent } from './svg-simple-linear-gauge.component';

describe('SvgSimpleLinearGaugeComponent', () => {
  let component: SvgSimpleLinearGaugeComponent;
  let fixture: ComponentFixture<SvgSimpleLinearGaugeComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ SvgSimpleLinearGaugeComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(SvgSimpleLinearGaugeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
