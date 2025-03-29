import { Component, inject, OnInit, ViewChild } from '@angular/core';
import { AppService } from '../../core/services/app-service';
import { AppSettingsService } from '../../core/services/app-settings.service';
import { MatButton } from '@angular/material/button';
import { MatDivider } from '@angular/material/divider';
import { MatCheckbox, MatCheckboxChange } from '@angular/material/checkbox';
import { MatSliderModule } from '@angular/material/slider';
import { FormsModule, NgForm } from '@angular/forms';

@Component({
    selector: 'settings-display',
    templateUrl: './display.component.html',
    styleUrls: ['./display.component.css'],
    standalone: true,
    imports: [
        FormsModule,
        MatCheckbox,
        MatDivider,
        MatButton,
        MatSliderModule,
    ],
})
export class SettingsDisplayComponent implements OnInit {
  @ViewChild('displayForm') displayForm: NgForm;
  public nightBrightness: number = 0.3;
  public autoNightMode: boolean = false;
  private app = inject(AppService);
  private settings = inject(AppSettingsService);

  ngOnInit() {
    this.nightBrightness = this.settings.getNightModeBrightness();
    this.autoNightMode = this.settings.getAutoNightMode();
  }

  protected saveAllSettings():void {
    this.settings.setAutoNightMode(this.autoNightMode);
    this.settings.setNightModeBrightness(this.nightBrightness);
    this.displayForm.form.markAsPristine();
    if (!this.app.isNightMode()) {
      this.app.setBrightness(1);
    }
  }

  protected isAutoNightModeSupported(e: MatCheckboxChange): void {
    if (e.checked) {
      this.app.validateAutoNightModeSupported();
    }
  }

  protected setBrightness(value: number): void {
    this.displayForm.form.markAsDirty();
    this.nightBrightness = value;
    this.app.setBrightness(value);
  }
}
