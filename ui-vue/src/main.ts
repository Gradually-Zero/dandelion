import { createApp } from 'vue';
import PrimeVue from 'primevue/config';
import Aura from '@primeuix/themes/aura';
import ToastService from 'primevue/toastservice';
import { definePreset, palette } from '@primeuix/themes';
import ConfirmationService from 'primevue/confirmationservice';
import App from './App.vue';
import router from './router';
import { loadUiTheme } from './utils/uiTheme';
import './style.css';

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

const app = createApp(App);

app.use(router);
app.use(PrimeVue, {
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
});
app.use(ToastService);
app.use(ConfirmationService);

loadUiTheme()
  .catch((error) => {
    console.error('Failed to load ui theme:', error);
  })
  .finally(() => {
    app.mount('#app');
  });
