import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { WidgetWindComponent } from './widget-windsteer.component';

describe('WidgetWindComponent', () => {
  let component: WidgetWindComponent;
  let fixture: ComponentFixture<WidgetWindComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
    imports: [WidgetWindComponent]
})
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(WidgetWindComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});
