import { SVGProps } from 'react';
import { createIcon } from '@consta/icons/Icon';

const IconPrinterStrokedSizeXS = (props: SVGProps<SVGSVGElement>) => (
  <svg width="12" height="12" viewBox="0 0 12 12" {...props}>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M2 3V2C2 1.44772 2.44772 1 3 1H9C9.55228 1 10 1.44772 10 2V3C10.5523 3 11 3.44772 11 4V8C11 8.55228 10.5523 9 10 9H9V10C9 10.5523 8.55228 11 8 11H4C3.44772 11 3 10.5523 3 10V9H2C1.44772 9 1 8.55228 1 8V4C1 3.44772 1.44772 3 2 3ZM3 2H9V3H3V2ZM3 8V6C3 5.44772 3.44772 5 4 5H8C8.55228 5 9 5.44772 9 6V8H10V4H2V8H3ZM4 6H8V10H4V6Z"
    />
  </svg>
);

const IconPrinterStrokedSizeS = (props: SVGProps<SVGSVGElement>) => (
  <svg width="16" height="16" viewBox="0 0 16 16" {...props}>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M3 2V4H2C1.44772 4 1 4.44772 1 5V12C1 12.5523 1.44772 13 2 13H4V14C4 14.5523 4.44772 15 5 15H11C11.5523 15 12 14.5523 12 14V13H14C14.5523 13 15 12.5523 15 12V5C15 4.44772 14.5523 4 14 4H13V2C13 1.44772 12.5523 1 12 1H4C3.44772 1 3 1.44772 3 2ZM5 3V4H11V3H5ZM12 11H13V6H3V11H4V9C4 8.44772 4.44772 8 5 8H11C11.5523 8 12 8.44772 12 9V11ZM6 13V10H10V13H6Z"
    />
  </svg>
);

const IconPrinterStrokedSizeM = (props: SVGProps<SVGSVGElement>) => (
  <svg width="24" height="24" viewBox="0 0 24 24" {...props}>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M6 3V6H3C2.44772 6 2 6.44771 2 7V17C2 17.5523 2.44772 18 3 18H6V21C6 21.5523 6.44771 22 7 22H17C17.5523 22 18 21.5523 18 21V12C18 11.4477 17.5523 11 17 11H7C6.44772 11 6 11.4477 6 12V16H4V8H20V16H18.0007V18H21C21.5523 18 22 17.5523 22 17V7C22 6.44772 21.5523 6 21 6H18V3C18 2.44772 17.5523 2 17 2H7C6.44772 2 6 2.44772 6 3ZM8 4V6H16V4H8ZM8 20V13H16V20H8Z"
    />
  </svg>
);

export const IconPrinterStroked = createIcon({
  name: 'IconPrinterStroked',
  xs: IconPrinterStrokedSizeXS,
  s: IconPrinterStrokedSizeS,
  m: IconPrinterStrokedSizeM,
  l: IconPrinterStrokedSizeM,
});
