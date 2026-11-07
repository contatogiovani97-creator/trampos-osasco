import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AlertController } from '@ionic/angular/lazy';
import { RouterModule } from '@angular/router';
import { vi } from 'vitest';

import { Tab3PageModule } from './tab3.module';
import { Tab3Page } from './tab3.page';

describe('Tab3Page', () => {
  let component: Tab3Page;
  let fixture: ComponentFixture<Tab3Page>;
  let feedbackAlert: { present: ReturnType<typeof vi.fn> };
  let createFeedbackAlert: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    feedbackAlert = { present: vi.fn().mockResolvedValue(undefined) };
    createFeedbackAlert = vi.fn().mockResolvedValue(feedbackAlert);
    await TestBed.configureTestingModule({
      imports: [Tab3PageModule, RouterModule.forRoot([])],
      providers: [{
        provide: AlertController,
        useValue: { create: createFeedbackAlert },
      }],
    }).compileComponents();

    fixture = TestBed.createComponent(Tab3Page);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('uses the shared bottom-aligned popover style for category and region', () => {
    expect(component.opportunitySelectPopoverOptions).toEqual({
      side: 'bottom',
      alignment: 'center',
      size: 'cover',
      cssClass: 'account-select-popover',
    });
  });

  it('shows a centered success alert after publishing an opportunity', async () => {
    vi.spyOn(component.backend, 'publishOpportunity').mockResolvedValue();

    await component.publishOpportunity();

    expect(createFeedbackAlert).toHaveBeenCalledWith(expect.objectContaining({
      header: 'Publicação concluída',
      message: 'Oportunidade publicada no mural da região.',
      buttons: ['OK'],
    }));
    expect(feedbackAlert.present).toHaveBeenCalled();
  });

  it('shows an error alert when publishing fails', async () => {
    vi.spyOn(component.backend, 'publishOpportunity').mockRejectedValue(new Error('Falha ao publicar'));
    vi.spyOn(component.backend, 'toUserMessage').mockReturnValue('Não foi possível publicar.');

    await component.publishOpportunity();

    expect(createFeedbackAlert).toHaveBeenCalledWith(expect.objectContaining({
      header: 'Não foi possível publicar',
      message: 'Não foi possível publicar.',
      buttons: ['OK'],
    }));
    expect(feedbackAlert.present).toHaveBeenCalled();
  });
});
