import { IonicModule } from '@ionic/angular/lazy';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessagesPageRoutingModule } from './messages-routing.module';
import { MessagesPage } from './messages.page';

@NgModule({
  imports: [IonicModule, CommonModule, FormsModule, MessagesPageRoutingModule],
  declarations: [MessagesPage],
})
export class MessagesPageModule {}
