import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WidgetHostComponent } from './widget-host.component';

describe('WidgetHostComponent', () => {
  let component: WidgetHostComponent;
  let fixture: ComponentFixture<WidgetHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WidgetHostComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WidgetHostComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
