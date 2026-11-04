import { Router } from '@angular/router';
import { NbMenuBag, NbMenuItem, NbMenuService, NbSidebarService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { LayoutComponent } from './layout.component';
import { AuthManager } from '../managers/auth-manager/auth.manager';
import { User } from '@shared/models/user.model';
import { UserRole } from '@shared/types/user-role';

describe('LayoutComponent', () => {
  const MOBILE = 500;
  const DESKTOP = 1200;

  let langChange: Subject<unknown>;
  let itemClick: Subject<NbMenuBag>;
  let sidebar: jasmine.SpyObj<NbSidebarService>;
  let authManager: jasmine.SpyObj<AuthManager>;
  let router: jasmine.SpyObj<Router>;
  let windowWidth: jasmine.Spy;
  let language: string;
  let component: LayoutComponent;

  const links = () => component.menuItems.map(item => item.link);
  const click = (item: Partial<NbMenuItem>) => itemClick.next({ tag: 'menu', item: item as NbMenuItem });

  beforeEach(() => {
    langChange = new Subject();
    itemClick = new Subject();
    language = 'en';

    const translate = {
      onLangChange: langChange,
      instant: (key: string) => `${language}:${key}`
    } as unknown as TranslateService;

    const menu = { onItemClick: () => itemClick } as unknown as NbMenuService;
    sidebar = jasmine.createSpyObj<NbSidebarService>('NbSidebarService', ['toggle', 'collapse']);
    authManager = jasmine.createSpyObj<AuthManager>('AuthManager', ['getCurrentUser', 'removeToken']);
    authManager.getCurrentUser.and.returnValue(new User({ userRole: UserRole.User }));
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    windowWidth = spyOnProperty(window, 'innerWidth').and.returnValue(DESKTOP);

    component = new LayoutComponent(translate, sidebar, menu, authManager, router);
  });

  afterEach(() => component.ngOnDestroy());

  describe('menu', () => {
    for (const role of [UserRole.User, UserRole.Moderator, UserRole.Admin]) {
      it(`should not show the admin items to ${role}`, () => {
        authManager.getCurrentUser.and.returnValue(new User({ userRole: role }));

        component.ngOnInit();

        expect(links()).toEqual(['/dashboard', '/apis', undefined]);
        expect(component.menuItems[2].data).toBe('logout');
      });
    }

    it('should show the base items without a user', () => {
      authManager.getCurrentUser.and.returnValue(null);

      component.ngOnInit();

      expect(component.menuItems.length).toBe(3);
    });

    it('should show the admin items to a SuperAdmin, with logout last', () => {
      authManager.getCurrentUser.and.returnValue(new User({ userRole: UserRole.SuperAdmin }));

      component.ngOnInit();

      expect(links()).toEqual(['/dashboard', '/apis', '/ips', undefined, undefined]);
      expect(component.menuItems[3].children?.map(item => item.link)).toEqual([
        '/admin/logs',
        '/admin/request-errors',
        '/admin/config',
        '/admin/memory'
      ]);
      expect(component.menuItems[4].data).toBe('logout');
    });

    it('should translate the titles', () => {
      component.ngOnInit();

      expect(component.menuItems[0].title).toBe('en:Menu.Dashboard');
    });

    it('should translate again when the language changes', () => {
      component.ngOnInit();

      language = 'hu';
      langChange.next({});

      expect(component.menuItems[0].title).toBe('hu:Menu.Dashboard');
    });

    it('should stop following language changes after destroy', () => {
      component.ngOnInit();
      component.ngOnDestroy();

      language = 'hu';
      langChange.next({});

      expect(component.menuItems[0].title).toBe('en:Menu.Dashboard');
    });
  });

  describe('logout', () => {
    beforeEach(() => component.ngOnInit());

    it('should remove the token and go to the login page', () => {
      click({ data: 'logout' });

      expect(authManager.removeToken).toHaveBeenCalledTimes(1);
      expect(router.navigate).toHaveBeenCalledOnceWith(['/login']);
    });

    it('should not log out for other items', () => {
      click({ link: '/apis' });

      expect(authManager.removeToken).not.toHaveBeenCalled();
    });
  });

  describe('sidebar', () => {
    beforeEach(() => component.ngOnInit());

    it('should toggle the sidebar', () => {
      component.toggleSidebar();

      expect(sidebar.toggle).toHaveBeenCalledOnceWith(false, 'menu-sidebar');
    });

    it('should collapse after a menu click on mobile', () => {
      windowWidth.and.returnValue(MOBILE);

      click({ link: '/apis' });

      expect(sidebar.collapse).toHaveBeenCalledOnceWith('menu-sidebar');
    });

    it('should stay open after a menu click on desktop', () => {
      click({ link: '/apis' });

      expect(sidebar.collapse).not.toHaveBeenCalled();
    });

    it('should collapse an open sidebar after a content click on mobile', () => {
      windowWidth.and.returnValue(MOBILE);
      component.toggleSidebar();

      component.onContentClick();

      expect(sidebar.collapse).toHaveBeenCalledOnceWith('menu-sidebar');
    });

    it('should collapse only once for repeated content clicks', () => {
      windowWidth.and.returnValue(MOBILE);
      component.toggleSidebar();

      component.onContentClick();
      component.onContentClick();

      expect(sidebar.collapse).toHaveBeenCalledTimes(1);
    });

    it('should ignore a content click when the sidebar is closed', () => {
      windowWidth.and.returnValue(MOBILE);

      component.onContentClick();

      expect(sidebar.collapse).not.toHaveBeenCalled();
    });

    it('should ignore a content click on desktop', () => {
      component.toggleSidebar();

      component.onContentClick();

      expect(sidebar.collapse).not.toHaveBeenCalled();
    });
  });
});
