import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { OsascoPage } from './osasco.page';

const routes: Routes = [
  {
    path: '',
    component: OsascoPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class OsascoPageRoutingModule {}
