import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { ResetConfigComponent } from './reset-config.component';

describe('ResetConfigComponent', () => {
  let component: ResetConfigComponent;
  let fixture: ComponentFixture<ResetConfigComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ ResetConfigComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ResetConfigComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});
