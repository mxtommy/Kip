import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { WidgetPositionComponent } from './widget-position.component';

describe('WidgetPositionComponent', () => {
  let component: WidgetPositionComponent;
  let fixture: ComponentFixture<WidgetPositionComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
    imports: [WidgetPositionComponent]
})
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(WidgetPositionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});
