import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BooleanControlConfigComponent } from './boolean-control-config.component';

describe('BooleanControlConfigComponent', () => {
  let component: BooleanControlConfigComponent;
  let fixture: ComponentFixture<BooleanControlConfigComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    imports: [BooleanControlConfigComponent]
})
    .compileComponents();

    fixture = TestBed.createComponent(BooleanControlConfigComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
