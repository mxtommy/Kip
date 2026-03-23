import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { SettingsConfigComponent } from './config.component';

describe('SettingsConfigComponent', () => {
  let component: SettingsConfigComponent;
  let fixture: ComponentFixture<SettingsConfigComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SettingsConfigComponent]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SettingsConfigComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});
