import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { SvgAutopilotV2Component } from './svg-autopilot-v2.component';

describe('SvgAutopilotComponent', () => {
  let component: SvgAutopilotV2Component;
  let fixture: ComponentFixture<SvgAutopilotV2Component>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
    imports: [SvgAutopilotV2Component]
})
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(SvgAutopilotV2Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
