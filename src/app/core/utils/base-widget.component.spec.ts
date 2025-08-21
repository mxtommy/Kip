import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BaseWidgetComponent } from './base-widget.component';
import type { IWidget, IWidgetSvcConfig } from '../interfaces/widgets-interface';

// Minimal concrete implementation for testing the abstract base class logic.
@Component({
  selector: 'kip-test-widget',
  template: '<div>Test Widget {{widgetProperties?.config?.displayName}}</div>'
})
class TestWidgetComponent extends BaseWidgetComponent {
  override defaultConfig: IWidgetSvcConfig = {
    displayName: 'Test Widget',
    displayScale: { lower: 0, upper: 100, type: 'linear' },
    numDecimal: 1,
    enableTimeout: false,
    dataTimeout: 10,
    paths: {
      main: {
        description: 'Main',
        path: 'self.test.path',
        source: null,
        pathType: 'number',
        isPathConfigurable: true,
        sampleTime: 1000
      }
    }
  };

  // Provide no-op implementations for abstract methods.
  protected override startWidget(): void { /* no-op for test */ }
  protected override updateConfig(): void { /* no-op for test */ }

  // Expose protected method for spec assertions
  public runValidateConfig(): void { this.validateConfig(); }

  // Public helpers for spec to set/get protected widgetProperties
  public setProps(p: IWidget): void { this.widgetProperties = p; }
  public get props(): IWidget { return this.widgetProperties; }
}

describe('BaseWidgetComponent (via TestWidgetComponent)', () => {
  let component: TestWidgetComponent;
  let fixture: ComponentFixture<TestWidgetComponent>;

  const widgetProps: IWidget = {
    uuid: 'test-uuid',
    type: 'test',
    config: {
      displayName: 'Test Widget',
      displayScale: { lower: 0, upper: 100, type: 'linear' },
      numDecimal: 1,
      enableTimeout: false,
      dataTimeout: 10,
      paths: {
        main: {
          description: 'Main',
          path: 'self.test.path',
          source: null,
          pathType: 'number',
          isPathConfigurable: true,
          sampleTime: 1000
        }
      }
    }
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TestWidgetComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(TestWidgetComponent);
    component = fixture.componentInstance;
  component.setProps(widgetProps);
    fixture.detectChanges();
  });

  it('should create concrete test widget', () => {
    expect(component).toBeTruthy();
  });

  it('validateConfig merges defaults (idempotent)', () => {
    // remove a property to ensure it gets merged back
  // assign through helper accessor
  delete (component.props.config as unknown as { numDecimal?: number }).numDecimal;
    component.runValidateConfig();
  expect(component.props.config.numDecimal).toBe(1);
  });
});
