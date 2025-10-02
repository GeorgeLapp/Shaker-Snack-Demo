import { SVGProps } from 'react';
import { createIcon } from '@consta/icons/Icon';

const IconDownloadSizeXS = (props: SVGProps<SVGSVGElement>) => (
  <svg width="12" height="12" viewBox="0 0 12 12" {...props}>
    <path d="M11 11V10H1V11H11Z" />
    <path d="M5.49895 1V7.29332L3.14126 4.92845L2.43416 5.63555L5.99895 9.20753L9.53906 5.66913L8.83196 4.96202L6.49895 7.29331V1H5.49895Z" />
  </svg>
);

const IconDownloadSizeS = (props: SVGProps<SVGSVGElement>) => (
  <svg width="16" height="16" viewBox="0 0 16 16" {...props}>
    <path d="M15 15V13H1V15H15Z" />
    <path d="M11.535 5.05965L8.99379 7.5942L9.0059 1H7.0059L6.9938 7.59421L4.46463 5.05965L3.05041 6.47386L7.99379 11.4226L12.9492 6.47386L11.535 5.05965Z" />
  </svg>
);

const IconDownloadSizeM = (props: SVGProps<SVGSVGElement>) => (
  <svg width="24" height="24" viewBox="0 0 24 24" {...props}>
    <path d="M22 22V20H2V22H22Z" />
    <path d="M18.59 8.59L20 10L12 18L4 10L5.41 8.59L11 14.17V2L13 2V14.17L18.59 8.59Z" />
  </svg>
);

export const IconDownload = createIcon({
  name: 'IconDownload',
  xs: IconDownloadSizeXS,
  s: IconDownloadSizeS,
  m: IconDownloadSizeM,
  l: IconDownloadSizeM,
});
