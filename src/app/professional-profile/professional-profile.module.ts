import { IonicModule } from '@ionic/angular/lazy';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProfessionalProfilePage } from './professional-profile.page';
import { ProfessionalProfileRoutingModule } from './professional-profile-routing.module';

@NgModule({
  imports: [IonicModule, CommonModule, ProfessionalProfileRoutingModule],
  declarations: [ProfessionalProfilePage],
})
export class ProfessionalProfilePageModule {}
