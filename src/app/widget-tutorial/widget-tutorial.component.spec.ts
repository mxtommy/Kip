import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { WidgetTutorialComponent } from './widget-tutorial.component';

describe('WidgetTutorialComponent', () => {
  let component: WidgetTutorialComponent;
  let fixture: ComponentFixture<WidgetTutorialComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ WidgetTutorialComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(WidgetTutorialComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});
