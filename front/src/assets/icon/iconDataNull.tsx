import { SVGProps } from 'react';
import { createIcon } from '@consta/icons/Icon';

const IconDataNullSizeXS = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" {...props}>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M1.72361 2.55279C1.893 2.214 2.23926 2 2.61803 2H9.38197C9.76074 2 10.107 2.214 10.2764 2.55279L11.8944 5.78885C11.9639 5.92771 12 6.08082 12 6.23607V10C12 10.5523 11.5523 11 11 11H1C0.447715 11 0 10.5523 0 10V6.23607C0 6.08082 0.036145 5.92771 0.105573 5.78885L1.72361 2.55279ZM3 3H9L10.5 6H9C8.44771 6 8 6.44772 8 7C8 7.55228 7.55228 8 7 8H5C4.44772 8 4 7.55228 4 7C4 6.44772 3.55228 6 3 6H1.5L3 3Z"
    />
  </svg>
);

const IconDataNullSizeS = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" {...props}>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M3.56619 2C3.21493 2 2.88942 2.1843 2.7087 2.4855L0.142507 6.76249C0.0492578 6.9179 0 7.09574 0 7.27698V13C0 13.5523 0.447715 14 1 14H15C15.5523 14 16 13.5523 16 13V7.27698C16 7.09574 15.9507 6.9179 15.8575 6.76249L13.2913 2.4855C13.1106 2.1843 12.7851 2 12.4338 2H3.56619ZM13.5 7L12 4H4L2.5 7H4C4.55228 7 5 7.44772 5 8V9C5 9.55228 5.44772 10 6 10H10C10.5523 10 11 9.55228 11 9V8C11 7.44772 11.4477 7 12 7H13.5Z"
    />
  </svg>
);

const IconDataNullSizeM = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" {...props}>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M4.70313 4.4453C4.8886 4.1671 5.20083 4 5.53518 4H18.4648C18.7992 4 19.1114 4.1671 19.2969 4.4453L22.8321 9.74808C22.9416 9.91234 23 10.1054 23 10.3028V19C23 19.5523 22.5523 20 22 20H2C1.44772 20 1 19.5523 1 19V10.3028C1 10.1054 1.05844 9.91234 1.16795 9.74808L4.70313 4.4453ZM6 6H18L20.5 10H18C17.4477 10 17 10.4477 17 11V13C17 13.5523 16.5523 14 16 14H8C7.44772 14 7 13.5523 7 13V11C7 10.4477 6.55228 10 6 10H3.5L6 6Z"
    />
  </svg>
);

export const IconDataNull = createIcon({
  name: 'IconDataNull',
  xs: IconDataNullSizeXS,
  s: IconDataNullSizeS,
  m: IconDataNullSizeM,
  l: IconDataNullSizeM,
});
