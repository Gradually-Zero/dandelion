import Aura from '@primeuix/themes/aura';
import { provideRouter } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { definePreset, palette } from '@primeuix/themes';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { routes } from './app.routes';

const CustomAura = definePreset(Aura, {
  semantic: {
    primary: palette('{purple}'),
    formField: {
      paddingY: '0.4375rem',
      sm: {
        fontSize: '0.875rem',
        paddingY: '0.1875rem',
      },
      lg: {
        fontSize: '1rem',
        paddingY: '0.625rem',
      },
    },
  },
});

const commonStyles = ({ props }: any) => ({
  style: {
    fontSize: !props?.size ? '14px' : undefined,
  },
});

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    ConfirmationService,
    MessageService,
    providePrimeNG({
      theme: {
        preset: CustomAura,
        options: {
          darkModeSelector: '.ddl-dark',
          cssLayer: {
            name: 'primevue',
            order: 'theme, base, primevue',
          },
        },
      },
      pt: {
        button: { root: commonStyles },
        inputtext: { root: commonStyles },
      },
    }),
  ],
};
