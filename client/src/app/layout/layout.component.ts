import { ChangeDetectionStrategy, Component, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { NbMenuItem, NbLayoutModule, NbMenuModule, NbMenuService, NbSidebarModule, NbSidebarService, NbButtonModule, NbIconModule } from '@nebular/theme';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { AuthManager } from '../managers/auth-manager/auth.manager';
import { UserRole } from '@shared/types/user-role';

@Component({
  standalone: true,
  selector: 'app-layout',
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterModule,
    NbLayoutModule,
    NbMenuModule,
    NbSidebarModule,
    NbButtonModule,
    NbIconModule,
    TranslateModule
  ]
})
export class LayoutComponent implements OnInit, OnDestroy {
  public menuItems: NbMenuItem[] = [];

  private _destroy$ = new Subject<void>();
  private _sidebarExpanded = false;

  constructor(
    private readonly _translateService: TranslateService,
    private readonly _sidebarService: NbSidebarService,
    private readonly _menuService: NbMenuService,
    private readonly _authManager: AuthManager,
    private readonly _router: Router
  ) {}

  public ngOnInit(): void {
    this._updateMenuTranslations();

    // Update menu when language changes
    this._translateService.onLangChange
      .pipe(takeUntil(this._destroy$))
      .subscribe(() => {
        this._updateMenuTranslations();
      });

    // Handle menu item clicks
    this._menuService.onItemClick()
      .pipe(takeUntil(this._destroy$))
      .subscribe(({ item }) => {
        // Close sidebar on mobile when menu item is clicked
        if (window.innerWidth < 768) {
          this._sidebarExpanded = false;
          this._sidebarService.collapse('menu-sidebar');
        }

        if (item.data === 'logout') {
          this._logout();
        }
      });
  }

  public ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  public toggleSidebar(): void {
    this._sidebarExpanded = !this._sidebarExpanded;
    this._sidebarService.toggle(false, 'menu-sidebar');
  }

  public onContentClick(): void {
    if (window.innerWidth < 768 && this._sidebarExpanded) {
      this._sidebarExpanded = false;
      this._sidebarService.collapse('menu-sidebar');
    }
  }

  private _logout(): void {
    this._authManager.removeToken();
    this._router.navigate(['/login']);
  }

  private _updateMenuTranslations(): void {
    const currentUser = this._authManager.getCurrentUser();

    this.menuItems = [
      {
        title: this._translateService.instant('Menu.Dashboard'),
        icon: 'home-outline',
        link: '/dashboard'
      },
      {
        title: this._translateService.instant('Menu.Apis'),
        icon: 'globe-outline',
        link: '/apis'
      },
    ];

    // Add SuperAdmin menu if user has SuperAdmin role
    if (currentUser?.userRole === UserRole.SuperAdmin) {
      this.menuItems.push({
        title: this._translateService.instant('Menu.Ips'),
        icon: 'monitor-outline',
        link: '/ips'
      });

      this.menuItems.push({
        title: this._translateService.instant('Menu.Config'),
        icon: 'settings-outline',
        link: '/config'
      });

      this.menuItems.push({
        title: this._translateService.instant('Menu.Admin.Title'),
        icon: 'shield-outline',
        children: [
          {
            title: this._translateService.instant('Menu.Admin.MemoryUsage'),
            icon: 'hard-drive-outline',
            link: '/admin/memory'
          }
        ]
      });
    }

    this.menuItems.push({
      title: this._translateService.instant('Menu.Logout'),
      icon: 'log-out-outline',
      data: 'logout'
    });
  }
}
