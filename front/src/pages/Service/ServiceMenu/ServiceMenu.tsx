import React, { FC } from 'react';
import { Text } from '@consta/uikit/Text';
import VerticalContainer from '../../../components/VerticalContainer';
import HorizontalContainer from '../../../components/HorizontalContainer';
import { Button } from '@consta/uikit/Button';
import { IconClose } from '@consta/icons/IconClose';
import { useNavigate } from 'react-router-dom';
import styles from './ServiceMenu.module.scss';
import ContentCard from '../../../components/ContentCard';
import { IconArrowRight } from '../../../assets/icon/iconArrowRight';
import { IconShakerCup } from '../../../assets/icon/iconShakerCup';
import { IconFavoriteFilled } from '../../../assets/icon/iconFavoriteFilled';
import { MenuItem } from './types';

/**
 * Сервисное меню
 */
const ServiceMenu: FC = () => {
  const navigate = useNavigate();

  const menuItems: MenuItem[] = [
    {
      title: 'Управление ячейками',
      description: 'Остатки, Глубина, Цены, Товары, Конфигурация ячеек',
      icon: <IconShakerCup size="m" className={styles.icon} />,
      onClick: () => handleCellControlClick(),
    },
    /*{
      title: 'Настройки покупки',
      description: 'Уведомления, Учёт остатков, Реклама и др.',
      icon: <IconWrench size="m" className={styles.icon} />,
      onClick: () => {},
    },
    {
      title: 'Настройки автомата',
      description: 'Температура, Подсветка, Серийный порт, Лифт',
      icon: <IconFilter size="m" className={styles.icon} />,
      onClick: () => {},
    },
    {
      title: 'Общие настройки',
      description: 'Список товаров, Сервер, Устройства, Роли',
      icon: <IconFilter size="m" className={styles.icon} />,
      onClick: () => {},
    },*/
    {
      title: 'Диагностика',
      description: 'Тест ячеек, ошибки, Информация, Логи',
      icon: <IconFavoriteFilled size="m" className={styles.icon} />,
      onClick: () => handleDiagnosticsClick(),
    },
    /*{
      title: 'Приложение',
      description: 'Файлы приложения, Настройки приложения',
      icon: <IconDollarCircle size="m" className={styles.icon} />,
      onClick: () => {},
    },*/
  ];

  // Обработчики
  function handleCellControlClick() {
    navigate('/menu/cellControl');
  }

  function handleDiagnosticsClick() {
    navigate('/menu/diagnostics');
  }

  const handleClose = () => {
    navigate('/', { state: { refreshProductMatrix: Date.now() } });
  };

  // render методы
  const renderHeader = () => (
    <HorizontalContainer isAutoWidth isAutoSpace>
      <Text size="3xl" weight="semibold">
        Настройки
      </Text>
      <Button
        view="secondary"
        size="m"
        onlyIcon
        iconLeft={IconClose}
        onClick={handleClose}
      />
    </HorizontalContainer>
  );

  const renderCard = ({ title, description, icon, onClick }: MenuItem) => (
    <ContentCard className={styles.contentCard} onClick={onClick}>
      <HorizontalContainer isAutoWidth isAutoSpace>
        <HorizontalContainer space="m">
          <div className={styles.circle}>{icon}</div>
          <VerticalContainer space="3xs">
            <Text size="l" weight="medium">
              {title}
            </Text>
            <Text size="m" view="secondary">
              {description}
            </Text>
          </VerticalContainer>
        </HorizontalContainer>
        <IconArrowRight size="m" className={styles.iconArrow} />
      </HorizontalContainer>
    </ContentCard>
  );

  const renderCards = () => (
    <VerticalContainer>
      {menuItems.map((item, index) => (
        <div key={index}>{renderCard(item)}</div>
      ))}
    </VerticalContainer>
  );

  return (
    <VerticalContainer space="l" className={styles.ServiceMenu}>
      {renderHeader()}
      {renderCards()}
    </VerticalContainer>
  );
};

export default ServiceMenu;
