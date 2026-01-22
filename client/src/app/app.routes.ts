import { Routes } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';
import { RoleGuard } from './guards/role.guard';
import { LayoutComponent } from './layout/layout.component';
import { UserRole } from '@shared/types/user-role';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'register',
    loadComponent: () => import('./pages/register/register.component').then(m => m.RegisterComponent)
  },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [AuthGuard],
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },
      {
        path: 'dashboard',
        loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'apis',
        loadComponent: () => import('./pages/apis/apis.component').then(m => m.ApisComponent)
      },
      {
        path: 'ips',
        loadComponent: () => import('./pages/ips/ips.component').then(m => m.IpsComponent)
      },
      {
        path: 'admin/memory',
        loadComponent: () => import('./pages/admin/memory/memory.component').then(m => m.MemoryComponent)
      },
      {
        path: 'config',
        loadComponent: () => import('./pages/config/config.component').then(m => m.ConfigComponent),
        canActivate: [RoleGuard],
        data: { roles: [UserRole.SuperAdmin] }
      }
    ]
  },
  {
    path: '**',
    redirectTo: ''
  }
];
