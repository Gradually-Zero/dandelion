import { CanDeactivateFn, Routes } from '@angular/router';
import { Home } from './home/home';
import type Editor from './editor/editor';

const canDeactivateEditor: CanDeactivateFn<Editor> = (component) => {
  return component.canDeactivateEditor();
};

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./main-layout/main-layout'),
    children: [
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
        canDeactivate: [canDeactivateEditor],
      },
      {
        path: 'conf',
        loadComponent: () => import('./conf/conf'),
      },
    ],
  },
];
