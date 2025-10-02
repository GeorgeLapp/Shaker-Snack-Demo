import { SVGProps } from 'react';
import { createIcon } from '@consta/icons/Icon';

const IconArrowDownFilledSizeXS = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" {...props}>
    <path d="M6.16671 10L1.50004 2L10.8334 2L6.16671 10Z" />
  </svg>
);

const IconArrowDownFilledSizeS = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" {...props}>
    <path d="M8 13L2 3L14 3L8 13Z" />
  </svg>
);

const IconArrowDownFilledSizeM = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" {...props}>
    <path d="M12 18L5 6L19 6L12 18Z" />
  </svg>
);

export const IconArrowDownFilled = createIcon({
  name: 'IconArrowDownFilled',
  xs: IconArrowDownFilledSizeXS,
  s: IconArrowDownFilledSizeS,
  m: IconArrowDownFilledSizeM,
  l: IconArrowDownFilledSizeM,
});
