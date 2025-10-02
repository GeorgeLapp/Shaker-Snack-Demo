import { SVGProps } from 'react';
import { createIcon } from '@consta/icons/Icon';

const IconAlertSizeXS = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" {...props}>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M11 6C11 8.76142 8.76142 11 6 11C3.23858 11 1 8.76142 1 6C1 3.23858 3.23858 1 6 1C8.76142 1 11 3.23858 11 6ZM6 3.125C6.20711 3.125 6.375 3.29289 6.375 3.5V6.5C6.375 6.70711 6.20711 6.875 6 6.875C5.79289 6.875 5.625 6.70711 5.625 6.5V3.5C5.625 3.29289 5.79289 3.125 6 3.125ZM6 8.5C6.27614 8.5 6.5 8.27614 6.5 8C6.5 7.72386 6.27614 7.5 6 7.5C5.72386 7.5 5.5 7.72386 5.5 8C5.5 8.27614 5.72386 8.5 6 8.5Z"
    />
  </svg>
);

const IconAlertSizeS = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" {...props}>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M14.6666 8.00004C14.6666 11.6819 11.6819 14.6667 7.99998 14.6667C4.31808 14.6667 1.33331 11.6819 1.33331 8.00004C1.33331 4.31814 4.31808 1.33337 7.99998 1.33337C11.6819 1.33337 14.6666 4.31814 14.6666 8.00004ZM7.99998 4.16671C8.27612 4.16671 8.49998 4.39056 8.49998 4.66671V8.66671C8.49998 8.94285 8.27612 9.16671 7.99998 9.16671C7.72384 9.16671 7.49998 8.94285 7.49998 8.66671V4.66671C7.49998 4.39056 7.72384 4.16671 7.99998 4.16671ZM7.99998 11.3334C8.36817 11.3334 8.66665 11.0349 8.66665 10.6667C8.66665 10.2985 8.36817 10 7.99998 10C7.63179 10 7.33331 10.2985 7.33331 10.6667C7.33331 11.0349 7.63179 11.3334 7.99998 11.3334Z"
    />
  </svg>
);

const IconAlertSizeM = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" {...props}>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12ZM12 6.25C12.4142 6.25 12.75 6.58579 12.75 7V13C12.75 13.4142 12.4142 13.75 12 13.75C11.5858 13.75 11.25 13.4142 11.25 13V7C11.25 6.58579 11.5858 6.25 12 6.25ZM12 17C12.5523 17 13 16.5523 13 16C13 15.4477 12.5523 15 12 15C11.4477 15 11 15.4477 11 16C11 16.5523 11.4477 17 12 17Z"
    />
  </svg>
);

export const IconAlert = createIcon({
  name: 'IconAlert',
  xs: IconAlertSizeXS,
  s: IconAlertSizeS,
  m: IconAlertSizeM,
  l: IconAlertSizeM,
});
