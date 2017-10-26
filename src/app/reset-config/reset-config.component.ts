import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';


import { AppSettingsService } from '../app-settings.service';



@Component({
  selector: 'app-reset-config',
  templateUrl: './reset-config.component.html',
  styleUrls: ['./reset-config.component.css']
})
export class ResetConfigComponent implements OnInit {

  constructor(
    private AppSettingsService: AppSettingsService,
    private route: ActivatedRoute) { }

    
  ngOnInit() {
    this.route.url.subscribe(url => {
      if (url[0].path == 'demo') {
        this.AppSettingsService.loadDemoConfig();
      } else {
        this.AppSettingsService.resetSettings();
      }
    });
  }

}
