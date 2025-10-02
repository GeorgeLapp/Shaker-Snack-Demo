import { SVGProps } from 'react';
import { createIcon } from '@consta/icons/Icon';

const IconMeatballSizeXS = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="2" viewBox="0 0 10 2" {...props}>
    <path d="M5 0C5.55228 -2.41411e-08 6 0.447715 6 1C6 1.55228 5.55228 2 5 2C4.44772 2 4 1.55228 4 1C4 0.447715 4.44772 2.41411e-08 5 0Z" />
    <path d="M1 0C1.55228 -2.41411e-08 2 0.447715 2 1C2 1.55228 1.55228 2 1 2C0.447715 2 2.41412e-08 1.55228 0 1C-2.41411e-08 0.447715 0.447715 2.41411e-08 1 0Z" />
    <path d="M9 0C9.55229 -2.41411e-08 10 0.447715 10 1C10 1.55228 9.55229 2 9 2C8.44771 2 8 1.55228 8 1C8 0.447715 8.44771 2.41411e-08 9 0Z" />
  </svg>
);

const IconMeatballSizeS = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" {...props}>
    <path d="M8 6C8.7732 6 9.4 6.67157 9.4 7.5C9.4 8.32843 8.7732 9 8 9C7.2268 9 6.6 8.32843 6.6 7.5C6.6 6.67157 7.2268 6 8 6Z" />
    <path d="M2.4 6C3.1732 6 3.8 6.67157 3.8 7.5C3.8 8.32843 3.1732 9 2.4 9C1.6268 9 1 8.32843 1 7.5C1 6.67157 1.6268 6 2.4 6Z" />
    <path d="M13.6 6C14.3732 6 15 6.67157 15 7.5C15 8.32843 14.3732 9 13.6 9C12.8268 9 12.2 8.32843 12.2 7.5C12.2 6.67157 12.8268 6 13.6 6Z" />
  </svg>
);

export const IconMeatballSizeM = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" {...props}>
    <path d="M12 10C13.1046 10 14 10.8954 14 12C14 13.1046 13.1046 14 12 14C10.8954 14 10 13.1046 10 12C10 10.8954 10.8954 10 12 10Z" />
    <path d="M4 10C5.10457 10 6 10.8954 6 12C6 13.1046 5.10457 14 4 14C2.89543 14 2 13.1046 2 12C2 10.8954 2.89543 10 4 10Z" />
    <path d="M20 10C21.1046 10 22 10.8954 22 12C22 13.1046 21.1046 14 20 14C18.8954 14 18 13.1046 18 12C18 10.8954 18.8954 10 20 10Z" />
  </svg>
);

export const IconMeatball = createIcon({
  name: 'IconMeatball',
  s: IconMeatballSizeS,
  m: IconMeatballSizeM,
  xs: IconMeatballSizeXS,
  l: IconMeatballSizeM,
});
