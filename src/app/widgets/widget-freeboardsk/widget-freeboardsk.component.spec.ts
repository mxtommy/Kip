import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { WidgetFreeboardskComponent } from './widget-freeboardsk.component';

describe('WidgetFreeboardskComponent', () => {
  let component: WidgetFreeboardskComponent;
  let fixture: ComponentFixture<WidgetFreeboardskComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WidgetFreeboardskComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WidgetFreeboardskComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
