import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SelectAutopilotComponent } from './select-autopilot.component';

describe('SelectAutopilotComponent', () => {
  let component: SelectAutopilotComponent;
  let fixture: ComponentFixture<SelectAutopilotComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SelectAutopilotComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SelectAutopilotComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
