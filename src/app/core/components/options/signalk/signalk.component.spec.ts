import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { SettingsSignalkComponent } from './signalk.component';

describe('SettingsSignalkComponent', () => {
  let component: SettingsSignalkComponent;
  let fixture: ComponentFixture<SettingsSignalkComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SettingsSignalkComponent]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SettingsSignalkComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});
