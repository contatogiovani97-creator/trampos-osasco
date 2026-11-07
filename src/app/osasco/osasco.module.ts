import { IonicModule } from '@ionic/angular/lazy';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OsascoPageRoutingModule } from './osasco-routing.module';
import { OsascoPage } from './osasco.page';

@NgModule({
  imports: [IonicModule, CommonModule, FormsModule, OsascoPageRoutingModule],
  declarations: [OsascoPage],
})
export class OsascoPageModule {}
