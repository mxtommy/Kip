import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WidgetTitleComponent } from './widget-title.component';

describe('WidgetTitleComponent', () => {
  let component: WidgetTitleComponent;
  let fixture: ComponentFixture<WidgetTitleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WidgetTitleComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WidgetTitleComponent);
    component = fixture.componentInstance;

    // Provide required inputs before first detectChanges
    fixture.componentRef.setInput('text', 'Test Title');
    fixture.componentRef.setInput('color', '#000000');

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
