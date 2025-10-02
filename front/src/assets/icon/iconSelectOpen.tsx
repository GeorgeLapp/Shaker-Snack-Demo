import { SVGProps } from 'react';
import { createIcon } from '@consta/icons/Icon';

const IconSelectOpenSizeXS = (props: SVGProps<SVGSVGElement>) => (
  <svg width="12" height="12" viewBox="0 0 12 12" {...props}>
    <path d="M5.55155 4.0045C5.79023 3.73599 6.20977 3.73599 6.44845 4.0045L9.11234 7.00138C9.45629 7.38832 9.1816 8 8.66389 8H3.33611C2.8184 8 2.54371 7.38832 2.88766 7.00138L5.55155 4.0045Z" />
  </svg>
);

const IconSelectOpenSizeS = (props: SVGProps<SVGSVGElement>) => (
  <svg width="16" height="16" viewBox="0 0 16 16" {...props}>
    <path d="M8.59464 5.66071C8.27684 5.3076 7.72316 5.3076 7.40536 5.66071L4.70166 8.66483C4.23832 9.17965 4.60367 10 5.29629 10H10.7037C11.3963 10 11.7617 9.17965 11.2983 8.66483L8.59464 5.66071Z" />
  </svg>
);

const IconSelectOpenSizeM = (props: SVGProps<SVGSVGElement>) => (
  <svg width="24" height="24" viewBox="0 0 24 24" {...props}>
    <path d="M8.77324 15C7.90313 15 7.44813 13.9657 8.03608 13.3243L11.2628 9.80417C11.6592 9.3718 12.3408 9.3718 12.7372 9.80417L15.9639 13.3243C16.5519 13.9657 16.0969 15 15.2268 15H8.77324Z" />
  </svg>
);

export const IconSelectOpen = createIcon({
  name: 'IconSelectOpen',
  xs: IconSelectOpenSizeXS,
  s: IconSelectOpenSizeS,
  m: IconSelectOpenSizeM,
  l: IconSelectOpenSizeM,
});
