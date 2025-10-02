import { SVGProps } from 'react';
import { createIcon } from '@consta/icons/Icon';

const IconSortSizeXS = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" {...props}>
    <path d="M10.5 2C10.7761 2 11 2.22386 11 2.5C11 2.77614 10.7761 3 10.5 3L1.5 3C1.22386 3 1 2.77614 1 2.5C1 2.22386 1.22386 2 1.5 2H10.5Z" />
    <path d="M7.5 5C7.77614 5 8 5.22386 8 5.5C8 5.77614 7.77614 6 7.5 6L1.5 6C1.22386 6 1 5.77614 1 5.5C1 5.22386 1.22386 5 1.5 5L7.5 5Z" />
    <path d="M4.5 9C4.77614 9 5 8.77614 5 8.5C5 8.22386 4.77614 8 4.5 8H1.5C1.22386 8 1 8.22386 1 8.5C1 8.77614 1.22386 9 1.5 9H4.5Z" />
  </svg>
);

const IconSortSizeS = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" {...props}>
    <path d="M2 4C2 3.44772 2.44772 3 3 3H13C13.5523 3 14 3.44772 14 4C14 4.55228 13.5523 5 13 5H3C2.44772 5 2 4.55228 2 4Z" />
    <path d="M2 8C2 7.44772 2.44772 7 3 7H9C9.55228 7 10 7.44772 10 8C10 8.55228 9.55228 9 9 9H3C2.44772 9 2 8.55228 2 8Z" />
    <path d="M6 12C6 11.4477 5.55228 11 5 11H3C2.44772 11 2 11.4477 2 12C2 12.5523 2.44772 13 3 13H5C5.55228 13 6 12.5523 6 12Z" />
  </svg>
);

const IconSortSizeM = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" {...props}>
    <path d="M3 17C3 17.5523 3.44772 18 4 18H8C8.55228 18 9 17.5523 9 17C9 16.4477 8.55228 16 8 16H4C3.44772 16 3 16.4477 3 17ZM4 6C3.44772 6 3 6.44772 3 7C3 7.55228 3.44772 8 4 8H20C20.5523 8 21 7.55228 21 7C21 6.44772 20.5523 6 20 6H4ZM3 12C3 12.5523 3.44772 13 4 13H14C14.5523 13 15 12.5523 15 12C15 11.4477 14.5523 11 14 11H4C3.44772 11 3 11.4477 3 12Z" />
  </svg>
);

export const IconSort = createIcon({
  name: 'IconSort',
  xs: IconSortSizeXS,
  s: IconSortSizeS,
  m: IconSortSizeM,
  l: IconSortSizeM,
});
