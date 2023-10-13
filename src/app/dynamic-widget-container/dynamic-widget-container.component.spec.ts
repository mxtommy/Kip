import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { DynamicWidgetContainerComponent } from './dynamic-widget-container.component';

describe('UnitWindowComponent', () => {
  let component: DynamicWidgetContainerComponent;
  let fixture: ComponentFixture<DynamicWidgetContainerComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ DynamicWidgetContainerComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(DynamicWidgetContainerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});
