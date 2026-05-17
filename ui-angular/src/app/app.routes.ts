import { Routes } from '@angular/router';
import { Home } from './home/home';
import { Conf } from './conf/conf';

export const routes: Routes = [
  {
    path: '',
    component: Home,
  },
  {
    path: 'find',
    loadComponent: () => import('./find/find'),
  },
  {
    path: 'editor',
    loadComponent: () => import('./editor/editor'),
  },
  {
    path: 'conf',
    component: Conf,
  },
];
