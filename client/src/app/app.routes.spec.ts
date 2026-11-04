import { Route } from '@angular/router';
import { routes } from './app.routes';
import { AuthGuard } from './guards/auth.guard';
import { DefaultRouteGuard } from './guards/default-route.guard';
import { RoleGuard } from './guards/role.guard';
import { UserRole } from '@shared/types/user-role';

describe('app routes', () => {
  const shell = routes.find(route => route.path === '' && route.component)!;
  const child = (path: string): Route => shell.children!.find(route => route.path === path)!;

  it('should keep login and register outside the authenticated shell', () => {
    for (const path of ['login', 'register']) {
      const route = routes.find(candidate => candidate.path === path)!;
      expect(route.loadComponent).toBeDefined();
      expect(route.canActivate).toBeUndefined();
    }
  });

  it('should protect the shell with AuthGuard', () => {
    expect(shell.canActivate).toEqual([AuthGuard]);
  });

  it('should resolve the empty path with DefaultRouteGuard', () => {
    expect(child('').canActivate).toEqual([DefaultRouteGuard]);
  });

  for (const path of ['admin/memory', 'admin/logs', 'admin/request-errors', 'admin/config']) {
    it(`should restrict ${path} to SuperAdmin`, () => {
      const route = child(path);
      expect(route.canActivate).toEqual([RoleGuard]);
      expect(route.data?.['roles']).toEqual([UserRole.SuperAdmin]);
    });
  }

  it('should redirect the legacy config path', () => {
    expect(child('config').redirectTo).toBe('admin/config');
  });

  it('should redirect unknown paths to the root', () => {
    expect(routes[routes.length - 1].path).toBe('**');
    expect(routes[routes.length - 1].redirectTo).toBe('');
  });

  it('should load every lazy page component', async () => {
    const lazy = [...routes, ...shell.children!].filter(route => route.loadComponent);

    expect(lazy.length).toBeGreaterThan(0);
    for (const route of lazy) {
      expect(await (route.loadComponent as () => Promise<unknown>)()).toBeDefined();
    }
  });
});
