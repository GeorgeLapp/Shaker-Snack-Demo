import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './assets/locales/en.json';
import ru from './assets/locales/ru.json';

const resources = {
  en,
  ru,
};

i18n.use(initReactI18next).init({
  resources,
  lng: 'ru',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
