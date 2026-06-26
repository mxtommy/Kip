import { Component, OnInit, inject, input } from '@angular/core';
import { FormGroupDirective, ReactiveFormsModule, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';

/**
 * Widget config sub-component for the Video widget. Binds to the widget config's nested `video`
 * FormGroup and lets the user pick a source and set display options.
 *
 * Today only the direct-URL source is enabled; the Scan / Camera / Uploaded sources are shown as
 * disabled "coming soon" slots so later updates light them up without re-laying-out the dialog.
 */
@Component({
  selector: 'video-camera-setup',
  templateUrl: './video-camera-setup.component.html',
  styleUrls: ['./video-camera-setup.component.scss'],
  imports: [
    ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatCheckboxModule, MatButtonToggleModule, MatIconModule
  ]
})
export class VideoCameraSetupComponent implements OnInit {
  readonly formGroupName = input.required<string>();
  private readonly rootFormGroup = inject(FormGroupDirective);
  protected videoGroup!: UntypedFormGroup;

  ngOnInit(): void {
    const existing = this.rootFormGroup.control.get(this.formGroupName());
    if (existing instanceof UntypedFormGroup) {
      this.videoGroup = existing;
    } else {
      this.videoGroup = new UntypedFormGroup({});
      this.rootFormGroup.control.addControl(this.formGroupName(), this.videoGroup);
    }
    this.ensure('sourceKind', 'url');
    this.ensure('url', null);
    this.ensure('muted', true);
    this.ensure('autoplay', false);
    this.ensure('loop', false);
    this.ensure('objectFit', 'contain');

    this.ensureGroup('snapshot', {
      embedTelemetry: true,
      embedLocation: true,
      defaultDestination: 'download'
    });
  }

  /** Currently selected source kind (defaults to 'url'). */
  protected get sourceKind(): string {
    return this.videoGroup?.get('sourceKind')?.value ?? 'url';
  }

  private ensure(name: string, defaultValue: unknown): void {
    if (!this.videoGroup.get(name)) {
      this.videoGroup.addControl(name, new UntypedFormControl(defaultValue));
    }
  }

  private ensureGroup(name: string, defaults: Record<string, unknown>): void {
    let group = this.videoGroup.get(name) as UntypedFormGroup | null;
    if (!(group instanceof UntypedFormGroup)) {
      group = new UntypedFormGroup({});
      this.videoGroup.addControl(name, group);
    }
    for (const [key, value] of Object.entries(defaults)) {
      if (!group.get(key)) {
        group.addControl(key, new UntypedFormControl(value));
      }
    }
  }
}
