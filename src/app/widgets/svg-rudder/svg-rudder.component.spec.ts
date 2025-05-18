import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { SvgRudderComponent } from './svg-rudder.component';

describe('SvgAutopilotComponent', () => {
  let component: SvgRudderComponent;
  let fixture: ComponentFixture<SvgRudderComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
    imports: [SvgRudderComponent]
})
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(SvgRudderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
