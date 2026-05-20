import { filter } from 'rxjs';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { LucideMinus, LucideSquare, LucideX } from '@lucide/angular';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { WindowRestoreIcon } from './window-restore-icon/window-restore-icon';
import type { Subscription } from 'rxjs';

const routeTitleMap: Record<string, string> = {
  '/': 'Home',
  '/find': 'Find',
  '/editor': 'Editor',
  '/conf': 'Configuration',
};

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, WindowRestoreIcon, LucideMinus, LucideSquare, LucideX],
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
