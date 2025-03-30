import { Routes } from '@angular/router';
import { SettingsConfigComponent } from './core/components/configuration/config.component';
import { DashboardComponent } from './core/components/dashboard/dashboard.component';
import { DashboardsEditorComponent } from './core/components/dashboards-editor/dashboards-editor.component';
import { DataInspectorComponent } from './core/components/data-inspector/data-inspector.component';
import { SettingsDatasetsComponent } from './core/components/datasets/datasets.component';
import { AppSettingsComponent } from './settings/settings/settings.component';
import { WidgetLoginComponent } from './widgets/widget-login/widget-login.component';
import { AppHelpComponent } from './core/components/app-help/app-help.component';

export const routes: Routes = [
  { path: 'dashboard', component: DashboardComponent },
  { path: 'settings', component: AppSettingsComponent },
  { path: 'help', component: AppHelpComponent },
  { path: 'data', component: DataInspectorComponent },
  { path: 'dashboards', component: DashboardsEditorComponent },
  { path: 'datasets', component: SettingsDatasetsComponent },
  { path: 'configurations', component: SettingsConfigComponent },
  { path: 'login', component: WidgetLoginComponent },
  { path: '**', component: DashboardComponent }
];
