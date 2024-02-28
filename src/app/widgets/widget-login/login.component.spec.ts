import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WidgetLoginComponent } from './widget-login.component';

describe('WidgetLoginComponent', () => {
  let component: WidgetLoginComponent;
  let fixture: ComponentFixture<WidgetLoginComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    imports: [WidgetLoginComponent]
})
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(WidgetLoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
