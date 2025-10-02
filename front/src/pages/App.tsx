import React, { useEffect, useState } from 'react';
import { Theme, ThemePreset } from '@consta/uikit/Theme';
import { presetGpnDark, presetGpnDefault } from '../theme';
import styles from './App.module.scss';
import { useAppDispatch, useAppSelector } from '../app/hooks/store';
import { Route, Routes } from 'react-router-dom';
import { useLocation } from 'react-router';
import i18n from 'i18next';
import Text from '../components/withTooltip/Text';
import { useTranslation } from 'react-i18next';
import ClientPage from './Client';

/**
 * Названия тем
 */
export enum ThemeName {
  gpnDefault = 'gpnDefault',
  gpnDark = 'gpnDark',
}

/**
 * Языки телеметрии
 */
export enum LanguageName {
  ru = 'ru',
  en = 'en',
}

function setBodyColorByTheme(theme: ThemeName) {
  if (theme === 'gpnDark') {
    document.body.style.backgroundColor = '#121212';
  } else{
    document.body.style.backgroundColor = '#edeef0';
  }
}

/**
 * Получение пресета темы
 *
 * @param themeName название темы
 */
function getPreset(themeName: ThemeName): ThemePreset {
  const obj = {
    gpnDefault: presetGpnDefault,
    gpnDark: presetGpnDark,
  };
  return obj[themeName] || presetGpnDefault;
}

const App: React.FC = () => {
  const { t } = useTranslation();
  ;

  const browserLanguage = navigator.language.startsWith('ru') ? LanguageName.ru : LanguageName.en;
  const browserTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
    ? ThemeName.gpnDark
    : ThemeName.gpnDefault;
  const location = useLocation();

  // const [theme, setTheme] = useState<ThemeName>(browserTheme);
  // const [language, setLanguage] = useState<LanguageName>(browserLanguage);

  // useEffect(() => {
  //   const theme = localStorage.getItem('theme');
  //
  //   theme && setTheme(theme as ThemeName);
  // }, []);

  // useEffect(() => {
  //   const language = localStorage.getItem('language');
  //
  //   language && i18n.changeLanguage(language as LanguageName);
  //   language && setLanguage(language as LanguageName);
  // }, []);

  // Handlers
  // const handleThemeChange = ({ value }: { value: ThemeName }) => {
  //   setTheme(value);
  //   localStorage.setItem('theme', value);
  // };
  //
  // const handleLanguageChange = ({ value }: { value: LanguageName }) => {
  //   localStorage.setItem('language', value);
  //
  //   i18n.changeLanguage(value);
  //   setLanguage(value);
  // };

  return (
    <Theme className={styles.theme} preset={getPreset(ThemeName.gpnDefault)}>
      <div className={styles.machineScreenWrapper}>
        <Routes>
          <Route path='/*' element={<ClientPage />} />
        </Routes>
      </div>
    </Theme>
  );
};

export default App;
