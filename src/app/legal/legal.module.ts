import { IonicModule } from '@ionic/angular/lazy';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LegalPage } from './legal.page';
import { LegalPageRoutingModule } from './legal-routing.module';

@NgModule({
  imports: [IonicModule, CommonModule, LegalPageRoutingModule],
  declarations: [LegalPage],
})
export class LegalPageModule {}
