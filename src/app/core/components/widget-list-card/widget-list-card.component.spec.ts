import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WidgetListCardComponent } from './widget-list-card.component';

describe('WidgetListCardComponent', () => {
  let component: WidgetListCardComponent;
  let fixture: ComponentFixture<WidgetListCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WidgetListCardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WidgetListCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
