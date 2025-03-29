import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WidgetLabelComponent } from './widget-label.component';

describe('WidgetLabelComponent', () => {
  let component: WidgetLabelComponent;
  let fixture: ComponentFixture<WidgetLabelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WidgetLabelComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WidgetLabelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
