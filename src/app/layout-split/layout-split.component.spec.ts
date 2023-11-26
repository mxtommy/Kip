import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { LayoutSplitComponent } from './layout-split.component';

describe('LayoutSplitComponent', () => {
  let component: LayoutSplitComponent;
  let fixture: ComponentFixture<LayoutSplitComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ LayoutSplitComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(LayoutSplitComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});
