import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AlertController } from '@ionic/angular/lazy';
import { Router, RouterModule } from '@angular/router';
import { vi } from 'vitest';

import { MarketplaceBackendService } from '../core/services/marketplace-backend.service';
import { AccountPageModule } from './account.module';
import { AccountPage } from './account.page';

describe('AccountPage', () => {
  let component: AccountPage;
  let fixture: ComponentFixture<AccountPage>;
  let dismissAlert: () => void;
  let dismissal: Promise<void>;
  let alert: {
    present: ReturnType<typeof vi.fn>;
    onDidDismiss: ReturnType<typeof vi.fn>;
  };
  let signOut: ReturnType<typeof vi.fn>;
  let loadInitialSiteData: ReturnType<typeof vi.fn>;
  let navigateByUrl: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    dismissal = Promise.resolve();
    alert = {
      present: vi.fn().mockResolvedValue(undefined),
      onDidDismiss: vi.fn(() => dismissal),
    };
    signOut = vi.fn().mockResolvedValue(undefined);
    loadInitialSiteData = vi.fn().mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [AccountPageModule, RouterModule.forRoot([])],
      providers: [
        {
          provide: AlertController,
          useValue: { create: vi.fn().mockResolvedValue(alert) },
        },
        {
          provide: MarketplaceBackendService,
          useValue: {
            isConfigured: true,
            authReady: () => true,
            currentUser: () => null,
            profile: () => null,
            profileLoading: () => false,
            register: vi.fn().mockResolvedValue(undefined),
            signIn: vi.fn().mockResolvedValue(undefined),
            signOut,
            loadInitialSiteData,
            toUserMessage: (error: unknown) => String(error),
          },
        },
      ],
    }).compileComponents();

    navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(AccountPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('returns to sign-in after the account creation success alert is dismissed', async () => {
    dismissal = new Promise<void>((resolve) => {
      dismissAlert = resolve;
    });
    alert.onDidDismiss.mockImplementation(() => dismissal);
    component.mode = 'register';
    component.email = 'usuario@example.com';
    component.password = 'senha-segura';

    const submission = component.submit();
    await vi.waitFor(() => expect(alert.present).toHaveBeenCalled());

    expect(signOut).not.toHaveBeenCalled();

    dismissAlert();
    await submission;

    expect(component.mode).toBe('signin');
    expect(component.email).toBe('usuario@example.com');
    expect(component.password).toBe('');
    expect(signOut).toHaveBeenCalledOnce();
  });

  it('shows a loading screen until initial site data finishes loading after sign-in', async () => {
    let finishLoading: () => void = () => undefined;
    loadInitialSiteData.mockImplementation(() => new Promise<void>((resolve) => {
      finishLoading = resolve;
    }));
    component.email = 'usuario@example.com';
    component.password = 'senha-segura';

    const submission = component.submit();
    await vi.waitFor(() => expect(loadInitialSiteData).toHaveBeenCalledOnce());
    fixture.detectChanges();

    expect(component.loadingSite()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Carregando seus dados');

    finishLoading();
    await submission;
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.loadingSite()).toBe(false);
    expect(fixture.nativeElement.textContent).not.toContain('Carregando seus dados');
  });

  it('navigates to the home page after successful sign-in without showing a success alert', async () => {
    component.email = 'usuario@example.com';
    component.password = 'senha-segura';

    await component.submit();

    expect(loadInitialSiteData).toHaveBeenCalledOnce();
    expect(navigateByUrl).toHaveBeenCalledWith('/tabs/tab1');
    expect(alert.present).not.toHaveBeenCalled();
  });
});
