import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { SvgWindsteerComponent } from './svg-windsteer.component';

describe('SvgWindComponent', () => {
  let component: SvgWindsteerComponent;
  let fixture: ComponentFixture<SvgWindsteerComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
    imports: [SvgWindsteerComponent]
})
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(SvgWindsteerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});
