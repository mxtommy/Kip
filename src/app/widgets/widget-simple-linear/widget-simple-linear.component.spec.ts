import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { signal, Component } from '@angular/core';
import { WidgetSimpleLinearComponent } from './widget-simple-linear.component';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';
import { WidgetStreamsDirective } from '../../core/directives/widget-streams.directive';
import { WidgetMetadataDirective } from '../../core/directives/widget-metadata.directive';

// Simple host wrapper to supply runtime directive context if needed later
@Component({
  template: `<widget-simple-linear [id]="id()" [type]="type()" [theme]="theme()" />`,
  imports: [WidgetSimpleLinearComponent, WidgetRuntimeDirective, WidgetStreamsDirective, WidgetMetadataDirective]
})
class HostTestComponent {
  id = signal('test-id');
  type = signal('widget-simple-linear');
  theme = signal<null>(null); // theme not required for bare instantiation test
  // runtime directive will pull DEFAULT_CONFIG internally when used
}

describe('WidgetSimpleLinearComponent (Host2)', () => {
  let fixture: ComponentFixture<HostTestComponent>;
  let host: HostTestComponent;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [HostTestComponent]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(HostTestComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(host).toBeTruthy();
  });
});
