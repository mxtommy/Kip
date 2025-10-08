import { Component } from '@angular/core';
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { signal } from '@angular/core';
import { <%= className %> } from './<%= selector %>.component';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';
import { WidgetStreamsDirective } from '../../core/directives/widget-streams.directive';
import { WidgetMetadataDirective } from '../../core/directives/widget-metadata.directive';

@Component({
  template: `<%= '<' + selector %> [id]="id()" [type]="type()" [theme]="theme()" />`,
  imports: [<%= className %>, WidgetRuntimeDirective, WidgetStreamsDirective, WidgetMetadataDirective]
})
class HostTestComponent {
  id = signal('test-id');
  type = signal('<%= selector %>');
  theme = signal<null>(null);
}

describe('<%= className %> (Host2)', () => {
  let fixture: ComponentFixture<HostTestComponent>;
  let host: HostTestComponent;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [HostTestComponent]
    }).compileComponents();
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
