import { SVGProps } from 'react';
import { createIcon } from '@consta/icons/Icon';

const IconSelectSizeXS = (props: SVGProps<SVGSVGElement>) => (
  <svg width="12" height="12" viewBox="0 0 12 12" {...props}>
    <path d="M5.55155 7.9955C5.79023 8.26401 6.20977 8.26401 6.44845 7.9955L9.11234 4.99862C9.45629 4.61168 9.1816 4 8.66389 4H3.33611C2.8184 4 2.54371 4.61168 2.88766 4.99862L5.55155 7.9955Z" />
  </svg>
);

const IconSelectSizeS = (props: SVGProps<SVGSVGElement>) => (
  <svg width="16" height="16" viewBox="0 0 16 16" {...props}>
    <path d="M5.29629 5C4.60367 5 4.23832 5.82035 4.70165 6.33517L7.40536 9.33929C7.72316 9.6924 8.27684 9.6924 8.59464 9.33929L11.2983 6.33517C11.7617 5.82035 11.3963 5 10.7037 5H5.29629Z" />
  </svg>
);

const IconSelectSizeM = (props: SVGProps<SVGSVGElement>) => (
  <svg width="24" height="24" viewBox="0 0 24 24" {...props}>
    <path d="M8.77324 9C7.90313 9 7.44813 10.0343 8.03608 10.6757L11.2628 14.1958C11.6592 14.6282 12.3408 14.6282 12.7372 14.1958L15.9639 10.6757C16.5519 10.0343 16.0969 9 15.2268 9H8.77324Z" />
  </svg>
);

export const IconSelect = createIcon({
  name: 'IconSelect',
  xs: IconSelectSizeXS,
  s: IconSelectSizeS,
  m: IconSelectSizeM,
  l: IconSelectSizeM,
});
