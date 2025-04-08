import { Routes } from '@angular/router';
import { DashboardComponent } from './core/components/dashboard/dashboard.component';

export const routes: Routes = [
  { path: 'dashboard', component: DashboardComponent },
  { path: 'dashboard', loadComponent: () => import('./core/components/dashboard/dashboard.component').then(m => m.DashboardComponent) },
  { path: 'settings', loadComponent: () => import('./settings/settings/settings.component').then(m => m.AppSettingsComponent) },
  { path: 'help', loadComponent: () => import('./core/components/app-help/app-help.component').then(m => m.AppHelpComponent) },
  { path: 'data', loadComponent: () => import('./core/components/data-inspector/data-inspector.component').then(m => m.DataInspectorComponent) },
  { path: 'dashboards', loadComponent: () => import('./core/components/dashboards-editor/dashboards-editor.component').then(m => m.DashboardsEditorComponent) },
  { path: 'datasets', loadComponent: () => import('./core/components/datasets/datasets.component').then(m => m.SettingsDatasetsComponent) },
  { path: 'configurations', loadComponent: () => import('./core/components/configuration/config.component').then(m => m.SettingsConfigComponent) },
  { path: 'login', loadComponent: () => import('./widgets/widget-login/widget-login.component').then(m => m.WidgetLoginComponent) },
  { path: '**', component: DashboardComponent }
];
