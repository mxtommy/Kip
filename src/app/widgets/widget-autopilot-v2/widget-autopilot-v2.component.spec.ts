import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { WidgetAutopilotV2Component } from './widget-autopilot-v2.component';

describe('WidgetAutopilotComponent', () => {
  let component: WidgetAutopilotV2Component;
  let fixture: ComponentFixture<WidgetAutopilotV2Component>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
    imports: [WidgetAutopilotV2Component]
})
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(WidgetAutopilotV2Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
