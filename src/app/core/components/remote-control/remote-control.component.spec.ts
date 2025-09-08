import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RemoteControlComponent } from './remote-control.component';

describe('RemoteControlComponent', () => {
  let component: RemoteControlComponent;
  let fixture: ComponentFixture<RemoteControlComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RemoteControlComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RemoteControlComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
