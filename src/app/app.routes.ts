import { Routes } from '@angular/router';
import { DashboardComponent } from './core/components/dashboard/dashboard.component';

export const routes: Routes = [
  { path: 'dashboard/:id',
    component: DashboardComponent
  },
  { path: 'home',
    loadComponent: () => import('./core/components/home/home.component').then(m => m.HomeComponent),
    title: 'KIP - Home'
  },
  { path: 'settings',
    loadComponent: () => import('./core/components/settings/settings/settings.component').then(m => m.AppSettingsComponent),
    title: 'KIP - Settings'
  },
  { path: 'help',
    loadComponent: () => import('./core/components/app-help/app-help.component').then(m => m.AppHelpComponent),
    title: 'KIP - Help'
  },
  { path: 'data',
    loadComponent: () => import('./core/components/data-inspector/data-inspector.component').then(m => m.DataInspectorComponent),
    title: 'KIP - Data Inspector'
  },
  { path: 'datasets',
    loadComponent: () => import('./core/components/datasets/datasets.component').then(m => m.SettingsDatasetsComponent),
    title: 'KIP - Datasets'
  },
  { path: 'login',
    loadComponent: () => import('./widgets/widget-login/widget-login.component').then(m => m.WidgetLoginComponent),
    title: 'Login'
  },
  { path: '**',
    component: DashboardComponent,
    title: 'KIP',
  }
];
