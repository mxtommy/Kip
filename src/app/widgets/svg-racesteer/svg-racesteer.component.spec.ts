import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { SvgRacesteerComponent } from './svg-racesteer.component';

describe('SvgRacesteerComponent', () => {
  let component: SvgRacesteerComponent;
  let fixture: ComponentFixture<SvgRacesteerComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
    imports: [SvgRacesteerComponent]
})
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(SvgRacesteerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});
