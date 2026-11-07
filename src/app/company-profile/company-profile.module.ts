import { IonicModule } from '@ionic/angular/lazy';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CompanyProfileRoutingModule } from './company-profile-routing.module';
import { CompanyProfilePage } from './company-profile.page';

@NgModule({
  imports: [IonicModule, CommonModule, CompanyProfileRoutingModule],
  declarations: [CompanyProfilePage],
})
export class CompanyProfilePageModule {}
