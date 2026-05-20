import { filter } from 'rxjs';
import { NgClass } from '@angular/common';
import { MenuModule } from 'primeng/menu';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { LucideFileCode, LucideHouse, LucideSearch, LucideSettings } from '@lucide/angular';
import type { Subscription } from 'rxjs';
import type { MenuItem } from 'primeng/api';

type NavigationIcon = 'house' | 'search' | 'fileCode' | 'settings';

interface NavigationMenuItem extends MenuItem {
  path: string;
  iconKey: NavigationIcon;
}

@Component({
  selector: 'app-main-layout',
  host: {
    class: 'flex min-h-0 flex-1',
  },
  imports: [
    RouterOutlet,
    NgClass,
    MenuModule,
    LucideFileCode,
    LucideHouse,
    LucideSearch,
    LucideSettings,
  ],
  templateUrl: './main-layout.html',
})
export default class MainLayout implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private routeSubscription?: Subscription;

  protected readonly currentPath = signal('');

  protected readonly menuItems: NavigationMenuItem[] = [
    { path: '/', label: 'Home', iconKey: 'house' },
    { path: '/find', label: 'Find', iconKey: 'search' },
    { path: '/editor', label: 'Editor', iconKey: 'fileCode' },
    { path: '/conf', label: 'Configuration', iconKey: 'settings' },
  ];

  constructor() {
    this.currentPath.set(this.router.url);
  }

  ngOnInit() {
    this.routeSubscription = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.currentPath.set(event.urlAfterRedirects);
      });
  }

  ngOnDestroy() {
    this.routeSubscription?.unsubscribe();
  }

  protected async navigateTo(path: string) {
    if (this.currentPath() === path) {
      return;
    }

    await this.router.navigateByUrl(path);
  }
}
