import {
  LucideFileCode,
  LucideHouse,
  LucideMinus,
  LucideSearch,
  LucideSettings,
  LucideSquare,
  LucideX,
} from '@lucide/angular';
import { filter } from 'rxjs';
import { NgClass } from '@angular/common';
import { MenuModule } from 'primeng/menu';
import { ToastModule } from 'primeng/toast';
import { ButtonModule } from 'primeng/button';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { WindowRestoreIcon } from './window-restore-icon/window-restore-icon';
import type { Subscription } from 'rxjs';
import type { MenuItem } from 'primeng/api';

type NavigationIcon = 'house' | 'search' | 'fileCode' | 'settings';

interface NavigationMenuItem extends MenuItem {
  path: string;
  iconKey: NavigationIcon;
}

const routeTitleMap: Record<string, string> = {
  '/': 'Home',
  '/find': 'Find',
  '/editor': 'Editor',
  '/conf': 'Configuration',
};

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    NgClass,
    ButtonModule,
    ConfirmDialogModule,
    MenuModule,
    ToastModule,
    WindowRestoreIcon,
    LucideFileCode,
    LucideHouse,
    LucideMinus,
    LucideSearch,
    LucideSettings,
    LucideSquare,
    LucideX,
  ],
  templateUrl: './app.html',
})
export class App implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly appWindow = getCurrentWindow();
  private routeSubscription?: Subscription;
  private unlistenResize?: () => void;

  protected readonly currentPath = signal('');
  protected readonly isMaximized = signal(false);
  protected readonly currentPageTitle = computed(
    () => routeTitleMap[this.currentPath()] ?? 'dandelion',
  );

  protected readonly menuItems: NavigationMenuItem[] = [
    { path: '/', label: 'Home', iconKey: 'house' },
    { path: '/find', label: 'Find', iconKey: 'search' },
    { path: '/editor', label: 'Editor', iconKey: 'fileCode' },
    { path: '/conf', label: 'Configuration', iconKey: 'settings' },
  ];

  constructor() {
    this.currentPath.set(this.router.url);
  }

  async ngOnInit() {
    this.routeSubscription = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.currentPath.set(event.urlAfterRedirects);
      });

    await this.syncMaximizedState();
    this.unlistenResize = await this.appWindow.onResized(async () => {
      await this.syncMaximizedState();
    });
  }

  ngOnDestroy() {
    this.routeSubscription?.unsubscribe();
    this.unlistenResize?.();
  }

  protected async navigateTo(path: string) {
    if (this.currentPath() === path) {
      return;
    }

    await this.router.navigateByUrl(path);
  }

  protected async syncMaximizedState() {
    this.isMaximized.set(await this.appWindow.isMaximized());
  }

  protected async handleTitlebarDoubleClick() {
    await this.toggleWindowMaximize();
  }

  protected async minimizeWindow() {
    await this.appWindow.minimize();
  }

  protected async toggleWindowMaximize() {
    await this.appWindow.toggleMaximize();
    await this.syncMaximizedState();
  }

  protected async closeWindow() {
    await this.appWindow.close();
  }
}
