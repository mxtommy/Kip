import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BaseWidgetComponent } from './base-widget.component';

describe('BaseWidgetComponent', () => {
  let component: BaseWidgetComponent;
  let fixture: ComponentFixture<BaseWidgetComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ BaseWidgetComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BaseWidgetComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
