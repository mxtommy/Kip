import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { Component } from '@angular/core';
import { ReactiveFormsModule, UntypedFormGroup } from '@angular/forms';
import { VideoCameraSetupComponent } from './video-camera-setup.component';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, VideoCameraSetupComponent],
  template: `<form [formGroup]="root"><video-camera-setup [formGroupName]="groupName" /></form>`
})
class HostComponent {
  // Start with an empty group so we exercise the control-ensuring path.
  root = new UntypedFormGroup({ video: new UntypedFormGroup({}) });
  groupName = 'video';
}

describe('VideoCameraSetupComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let videoGroup: UntypedFormGroup;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    videoGroup = fixture.componentInstance.root.get('video') as UntypedFormGroup;
  });

  it('ensures default controls and renders the source + URL fields', () => {
    fixture.detectChanges();
    expect(videoGroup.get('sourceKind')?.value).toBe('url');
    expect(videoGroup.get('objectFit')?.value).toBe('contain');
    expect(videoGroup.get('muted')?.value).toBe(true);
    expect(videoGroup.get('autoplay')?.value).toBe(false);
    expect(videoGroup.get('loop')?.value).toBe(false);

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('mat-button-toggle-group')).not.toBeNull();
    expect(el.querySelector('input[type="url"]')).not.toBeNull();
  });

  it('binds the URL control to the input', () => {
    fixture.detectChanges();
    videoGroup.get('url')?.setValue('https://cam.example/v.mp4');
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input[type="url"]') as HTMLInputElement;
    expect(input.value).toBe('https://cam.example/v.mp4');
  });
});
