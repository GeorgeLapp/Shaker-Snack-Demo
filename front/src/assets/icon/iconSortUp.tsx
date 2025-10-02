import { SVGProps } from 'react';
import { createIcon } from '@consta/icons/Icon';

const IconSortUpSizeXS = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" {...props}>
    <path d="M4.5 2C4.77614 2 5 2.22386 5 2.5C5 2.77614 4.77614 3 4.5 3L1.5 3C1.22386 3 1 2.77614 1 2.5C1 2.22386 1.22386 2 1.5 2H4.5Z" />
    <path d="M7.5 6C7.77614 6 8 5.77614 8 5.5C8 5.22386 7.77614 5 7.5 5L1.5 5C1.22386 5 1 5.22386 1 5.5C1 5.77614 1.22386 6 1.5 6L7.5 6Z" />
    <path d="M10.5 9C10.7761 9 11 8.77614 11 8.5C11 8.22386 10.7761 8 10.5 8L1.5 8C1.22386 8 1 8.22386 1 8.5C1 8.77614 1.22386 9 1.5 9L10.5 9Z" />
  </svg>
);

const IconSortUpSizeS = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" {...props}>
    <path d="M6 4C6 4.55228 5.55228 5 5 5H3C2.44772 5 2 4.55228 2 4C2 3.44772 2.44772 3 3 3H5C5.55228 3 6 3.44772 6 4Z" />
    <path d="M3 7C2.44772 7 2 7.44772 2 8C2 8.55228 2.44772 9 3 9H9C9.55228 9 10 8.55228 10 8C10 7.44772 9.55228 7 9 7H3Z" />
    <path d="M2 12C2 12.5523 2.44772 13 3 13H13C13.5523 13 14 12.5523 14 12C14 11.4477 13.5523 11 13 11H3C2.44772 11 2 11.4477 2 12Z" />
  </svg>
);

const IconSortUpSizeM = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" {...props}>
    <path d="M3 7C3 7.55228 3.44772 8 4 8H8C8.55228 8 9 7.55228 9 7C9 6.44772 8.55228 6 8 6H4C3.44772 6 3 6.44772 3 7ZM4 16C3.44772 16 3 16.4477 3 17C3 17.5523 3.44772 18 4 18H20C20.5523 18 21 17.5523 21 17C21 16.4477 20.5523 16 20 16H4ZM3 12C3 12.5523 3.44772 13 4 13H14C14.5523 13 15 12.5523 15 12C15 11.4477 14.5523 11 14 11H4C3.44772 11 3 11.4477 3 12Z" />
  </svg>
);

export const IconSortUp = createIcon({
  name: 'IconSortUp',
  xs: IconSortUpSizeXS,
  s: IconSortUpSizeS,
  m: IconSortUpSizeM,
  l: IconSortUpSizeM,
});
