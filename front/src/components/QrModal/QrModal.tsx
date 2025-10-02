import React, { FC, useState } from 'react';
import DefaultModal from '../DefaultModal';
import html2canvas from 'html2canvas';
import VerticalContainer from '../VerticalContainer';
import { Text } from '@consta/uikit/Text';
import HorizontalContainer from '../HorizontalContainer';
import { Button } from '@consta/uikit/Button';
import { IconPrinterStroked } from '../../assets/icon/iconPrinterStroked';
import { IconDownload } from '../../assets/icon/iconDownload';
import styles from './QrModal.module.scss';
import classNames from 'classnames';
import { QRCodeSVG } from 'qrcode.react';

type QrModalProps = {
  isOpen: boolean;
  isActiveKey?: boolean;

  fileName: string;
  code: string | null;
  modalTitle: string;
  activeDescription?: string;
  blockDescription?: string;
  noCodeDescription?: string;

  renderActions?: () => React.ReactNode;
  onClose?: () => void;
};

const QrModal: FC<QrModalProps> = ({
  isOpen,
  isActiveKey,

  fileName,
  code,
  modalTitle,
  activeDescription,
  blockDescription,
  noCodeDescription,

  renderActions,
  onClose,
}) => {
  const [isPrint, setIsPrint] = useState(false);

  // Путь к изображению в папке public
  const logoImagePath = import.meta.env.VITE_PUBLIC_URL + '/img/qr-logo.png';

  // Обработчики
  const handleDownload = () => {
    html2canvas(document.querySelector('#react-qrcode-logo') as any).then(function (canvas) {
      const link = document.createElement('a');
      link.download = `${fileName}-qr-code.png`;
      link.href = canvas.toDataURL();
      link.click();
    });
  };

  const handlePrint = () => {
    html2canvas(document.querySelector('#react-qrcode-logo') as any).then(function (canvas) {
      const imgData = canvas.toDataURL();

      // Создать новый элемент img с изображением для печати
      const img = new Image();
      img.onload = function () {
        // Создать новый элемент для печати
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.open();
          printWindow.document.write('<img src="' + img.src + '" />');

          // Добавить текст после картинки
          printWindow.document.write(
            '<p id="key" style="font-size: 18px; color: #21201f; font-weight: 600; margin-left: 100px">key</p>',
          );

          const element = printWindow.document.getElementById('key');
          if (element) {
            element.innerText = code || '';

            // Добавить задержку после изменения текста
            setTimeout(() => {
              null;
            }, 500); // задержка 500 миллисекунд (0.5 секунды)
          }

          printWindow.document.close();

          // Создать новый промис для печати
          new Promise<void>(function (resolve) {
            resolve();
          }).then(function () {
            printWindow.print();
          });
        }
      };
      img.src = imgData;
    });
  };

  // render методы
  const renderActiveKey = (code: string) => (
    <VerticalContainer space="l" align="center" isAutoWidth>
      <div className={styles.qrContainer}>
        <QRCodeSVG
          value={code}
          // qrStyle="fluid"
          // logoImage={logoImagePath}
          // logoPadding={5}
          // logoWidth={53}
          // logoHeight={53}
          size={isPrint ? 100 : 257}
        />
      </div>
      <Text size="xl" weight="semibold">
        {code}
      </Text>
      {activeDescription && (
        <Text weight="medium" align="center" size="l" view="secondary">
          {activeDescription}
        </Text>
      )}
      {!isPrint && (
        <HorizontalContainer space="2xl" align="center" justify="center">
          <Button
            size="l"
            view="ghost"
            onlyIcon
            iconLeft={IconPrinterStroked as any}
            onClick={handlePrint}
          />
          <Button
            size="l"
            view="ghost"
            onlyIcon
            iconLeft={IconDownload as any}
            onClick={handleDownload}
          />
        </HorizontalContainer>
      )}
    </VerticalContainer>
  );

  const renderBlockKey = () => (
    <VerticalContainer space="xl" align="center">
      {blockDescription && (
        <Text weight="medium" align="center" size="l" view="alert">
          {blockDescription}
        </Text>
      )}
    </VerticalContainer>
  );

  const renderNoKey = () => (
    <VerticalContainer space="xl" align="center">
      {noCodeDescription && (
        <Text weight="medium" align="center" size="l" view="alert">
          {noCodeDescription}
        </Text>
      )}
    </VerticalContainer>
  );

  return (
    <DefaultModal
      className={classNames(styles.QrModal, isPrint && styles.isPrint)}
      isOpen={isOpen}
      isPrint={isPrint}
      modalTitle={modalTitle}
      renderActions={renderActions}
      onClose={onClose}
    >
      <div className={classNames(styles.card)}>
        {code ? <>{isActiveKey ? renderActiveKey(code) : renderBlockKey()}</> : renderNoKey()}
      </div>
    </DefaultModal>
  );
};

export default QrModal;
