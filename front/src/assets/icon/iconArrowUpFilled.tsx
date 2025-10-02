import { SVGProps } from 'react';
import { createIcon } from '@consta/icons/Icon';

const IconArrowUpFilledSizeXS = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" {...props}>
    <path d="M6.16667 2L10.8333 10H1.5L6.16667 2Z" />
  </svg>
);

const IconArrowUpFilledSizeS = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" {...props}>
    <path d="M8 3L14 13H2L8 3Z" />
  </svg>
);

const IconArrowUpFilledSizeM = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" {...props}>
    <path d="M12 6L19 18H5L12 6Z" />
  </svg>
);

export const IconArrowUpFilled = createIcon({
  name: 'IconArrowUpFilled',
  xs: IconArrowUpFilledSizeXS,
  s: IconArrowUpFilledSizeS,
  m: IconArrowUpFilledSizeM,
  l: IconArrowUpFilledSizeM,
});
