import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UntypedFormControl, UntypedFormGroup, ReactiveFormsModule } from '@angular/forms';
import { provideHttpClient } from '@angular/common/http';

import { SelectAutopilotComponent } from './select-autopilot.component';
import { Component } from '@angular/core';
import { SignalkPluginsService } from '../../core/services/signalk-plugins.service';

@Component({
  selector: 'host-wrapper',
  standalone: true,
  imports: [ReactiveFormsModule, SelectAutopilotComponent],
  template: `<form [formGroup]="root"><select-autopilot [formGroupName]="groupName"></select-autopilot></form>`
})
class HostWrapperComponent {
  root = new UntypedFormGroup({ ap: new UntypedFormGroup({
    apiVersion: new UntypedFormControl(null),
    pluginId: new UntypedFormControl(null),
    modes: new UntypedFormControl(null),
    instanceId: new UntypedFormControl(''),
    headingDirectionTrue: new UntypedFormControl(false),
    invertRudder: new UntypedFormControl(false)
  }) });
  groupName = 'ap';
}

describe('SelectAutopilotComponent', () => {
  let fixture: ComponentFixture<HostWrapperComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostWrapperComponent],
      providers: [
        provideHttpClient(),
        { provide: SignalkPluginsService, useValue: { isEnabled: () => Promise.resolve(false) } }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HostWrapperComponent);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
