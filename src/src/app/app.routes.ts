import { Routes } from '@angular/router';

export const routes: Routes = [
  { 
    path: '', 
    redirectTo: 'upload', 
    pathMatch: 'full' 
  },
  { 
    path: 'upload', 
    loadComponent: () => import('./features/upload/upload.component').then(m => m.UploadComponent) 
  },
  { 
    path: 'preview', 
    loadComponent: () => import('./features/preview/preview.component').then(m => m.PreviewComponent) 
  },
  { 
    path: 'export', 
    loadComponent: () => import('./features/export/export.component').then(m => m.ExportComponent) 
  },
  { 
    path: '**', 
    redirectTo: 'upload' 
  }
];
