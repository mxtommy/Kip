import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { ModalWidgetComponent } from './modal-widget.component';

describe('ModalWidgetComponent', () => {
  let component: ModalWidgetComponent;
  let fixture: ComponentFixture<ModalWidgetComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ ModalWidgetComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ModalWidgetComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});
