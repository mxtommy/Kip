import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DisplayDatetimeComponent } from './display-datetime.component';

describe('DisplayDatetimeComponent', () => {
  let component: DisplayDatetimeComponent;
  let fixture: ComponentFixture<DisplayDatetimeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ DisplayDatetimeComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DisplayDatetimeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
