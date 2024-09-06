import { Routes } from '@angular/router';
import { AppHelpComponent } from './core/components/app-help/app-help.component';
import { SettingsConfigComponent } from './core/components/configuration/config.component';
import { DashboardComponent } from './core/components/dashboard/dashboard.component';
import { DashboardsManageComponent } from './core/components/dashboards-manage/dashboards-manage.component';
import { DataBrowserComponent } from './core/components/data-browser/data-browser.component';
import { SettingsDatasetsComponent } from './core/components/datasets/datasets.component';
import { SettingsResetComponent } from './core/components/reset/reset.component';
import { AppSettingsComponent } from './settings/settings/settings.component';
import { WidgetLoginComponent } from './widgets/widget-login/widget-login.component';

export const routes: Routes = [
  { path: 'dashboard', component: DashboardComponent },
  { path: 'settings', component: AppSettingsComponent },
  { path: 'help', component: AppHelpComponent },
  { path: 'data', component: DataBrowserComponent },
  { path: 'dashboards', component: DashboardsManageComponent },
  { path: 'datasets', component: SettingsDatasetsComponent },
  { path: 'configurations', component: SettingsConfigComponent },
  { path: 'reset', component: SettingsResetComponent },
  { path: 'login', component: WidgetLoginComponent },
  { path: '**', component: DashboardComponent }
];
