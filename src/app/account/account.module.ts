import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular/lazy';
import { AccountPageRoutingModule } from './account-routing.module';
import { AccountPage } from './account.page';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, AccountPageRoutingModule],
  declarations: [AccountPage],
})
export class AccountPageModule {}
