import { Routes } from '@angular/router';
import { AppHelpComponent } from './core/components/app-help/app-help.component';
import { SettingsConfigComponent } from './core/components/configuration/config.component';
import { DashboardComponent } from './core/components/dashboard/dashboard.component';
import { DashboardsEditorComponent } from './core/components/dashboards-editor/dashboards-editor.component';
import { DataBrowserComponent } from './core/components/data-browser/data-browser.component';
import { SettingsDatasetsComponent } from './core/components/datasets/datasets.component';
import { AppSettingsComponent } from './settings/settings/settings.component';
import { WidgetLoginComponent } from './widgets/widget-login/widget-login.component';

export const routes: Routes = [
  { path: 'dashboard', component: DashboardComponent },
  { path: 'settings', component: AppSettingsComponent },
  { path: 'help', component: AppHelpComponent },
  { path: 'data', component: DataBrowserComponent },
  { path: 'dashboards', component: DashboardsEditorComponent },
  { path: 'datasets', component: SettingsDatasetsComponent },
  { path: 'configurations', component: SettingsConfigComponent },
  { path: 'login', component: WidgetLoginComponent },
  { path: '**', component: DashboardComponent }
];
