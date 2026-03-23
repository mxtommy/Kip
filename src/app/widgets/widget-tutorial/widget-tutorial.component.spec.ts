import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { WidgetTutorialComponent } from './widget-tutorial.component';

describe('WidgetTutorialComponent', () => {
  let component: WidgetTutorialComponent;
  let fixture: ComponentFixture<WidgetTutorialComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WidgetTutorialComponent]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(WidgetTutorialComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});
