import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { DataInspectorComponent } from './data-inspector.component';

describe('DataBrowserComponent', () => {
  let component: DataInspectorComponent;
  let fixture: ComponentFixture<DataInspectorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DataInspectorComponent]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DataInspectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
