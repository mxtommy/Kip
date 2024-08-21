import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { WidgetTextComponent } from './widget-text.component';

describe('WidgetTextComponent', () => {
  let component: WidgetTextComponent;
  let fixture: ComponentFixture<WidgetTextComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
    imports: [WidgetTextComponent]
})
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(WidgetTextComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});
