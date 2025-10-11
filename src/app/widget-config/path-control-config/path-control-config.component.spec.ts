import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { PathControlConfigComponent } from './path-control-config.component';

describe('PathControlConfigComponent', () => {
  let component: PathControlConfigComponent;
  let fixture: ComponentFixture<PathControlConfigComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
    imports: [PathControlConfigComponent]
})
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(PathControlConfigComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});
