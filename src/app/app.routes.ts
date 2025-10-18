import { Routes } from '@angular/router';
import { DashboardComponent } from './core/components/dashboard/dashboard.component';
import { splitShellGuard } from './core/guards/split-shell.guard';

export const routes: Routes = [
  {
    path: 'dashboard/:id',
    component: DashboardComponent,
    canMatch: [splitShellGuard]
  },
  {
    path: 'chartplotter/:id',
    loadComponent: () => import('./core/components/split-shell/split-shell.component').then(m => m.SplitShellComponent),
    canMatch: [splitShellGuard]
  },
  {
    path: 'settings',
    loadComponent: () => import('./core/components/settings/settings.component').then(m => m.SettingsComponent),
    title: 'KIP - Settings'
  },
  {
    path: 'options',
    loadComponent: () => import('./core/components/options/tabs/tabs.component').then(m => m.TabsComponent),
    title: 'KIP - Options'
  },
  {
    path: 'remote',
    loadComponent: () => import('./core/components/remote-control/remote-control.component').then(m => m.RemoteControlComponent),
    title: 'KIP - Remote Control'
  },
  {
    path: 'help',
    loadComponent: () => import('./core/components/app-help/app-help.component').then(m => m.AppHelpComponent),
    title: 'KIP - Help'
  },
  {
    path: 'data',
    loadComponent: () => import('./core/components/data-inspector/data-inspector.component').then(m => m.DataInspectorComponent),
    title: 'KIP - Data Inspector'
  },
  {
    path: 'login',
    loadComponent: () => import('./widgets/widget-login/widget-login.component').then(m => m.WidgetLoginComponent),
    title: 'Login'
  },
  {
    path: '**',
    component: DashboardComponent,
    canMatch: [splitShellGuard]
  }
];
