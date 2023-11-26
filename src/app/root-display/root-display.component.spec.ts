import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { RootDisplayComponent } from './root-display.component';

describe('RootDisplayComponent', () => {
  let component: RootDisplayComponent;
  let fixture: ComponentFixture<RootDisplayComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ RootDisplayComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(RootDisplayComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});
