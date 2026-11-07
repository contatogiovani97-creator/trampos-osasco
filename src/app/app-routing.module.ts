import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('./tabs/tabs.module').then(m => m.TabsPageModule)
  },
  {
    path: 'professional/:id',
    loadChildren: () => import('./professional-profile/professional-profile.module')
      .then(m => m.ProfessionalProfilePageModule)
  },
  {
    path: 'company/:id',
    loadChildren: () => import('./company-profile/company-profile.module')
      .then(m => m.CompanyProfilePageModule)
  },
  {
    path: 'legal',
    loadChildren: () => import('./legal/legal.module').then(m => m.LegalPageModule)
  }
];
@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule {}
