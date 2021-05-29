import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { SvgAutopilotComponent } from './svg-autopilot.component';

describe('SvgAutopilotComponent', () => {
  let component: SvgAutopilotComponent;
  let fixture: ComponentFixture<SvgAutopilotComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ SvgAutopilotComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(SvgAutopilotComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
