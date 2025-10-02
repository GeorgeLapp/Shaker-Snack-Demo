import { SVGProps } from 'react';
import { createIcon } from '@consta/icons/Icon';

const IconUnSortSizeXS = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" {...props}>
    <path d="M10.5 2C10.7761 2 11 2.22386 11 2.5C11 2.77614 10.7761 3 10.5 3L1.5 3C1.22386 3 1 2.77614 1 2.5C1 2.22386 1.22386 2 1.5 2H10.5Z" />
    <path d="M7.5 8C7.77614 8 8 8.22386 8 8.5C8 8.77614 7.77614 9 7.5 9H1.5C1.22386 9 1 8.77614 1 8.5C1 8.22386 1.22386 8 1.5 8H7.5Z" />
    <path d="M4.5 6C4.77614 6 5 5.77614 5 5.5C5 5.22386 4.77614 5 4.5 5H1.5C1.22386 5 1 5.22386 1 5.5C1 5.77614 1.22386 6 1.5 6H4.5Z" />
  </svg>
);

const IconUnSortSizeS = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" {...props}>
    <path d="M2 4C2 3.44772 2.44772 3 3 3H13C13.5523 3 14 3.44772 14 4C14 4.55228 13.5523 5 13 5H3C2.44772 5 2 4.55228 2 4Z" />
    <path d="M2 12C2 11.4477 2.44772 11 3 11H9C9.55228 11 10 11.4477 10 12C10 12.5523 9.55228 13 9 13H3C2.44772 13 2 12.5523 2 12Z" />
    <path d="M6 8C6 7.44772 5.55228 7 5 7H3C2.44772 7 2 7.44772 2 8C2 8.55228 2.44772 9 3 9H5C5.55228 9 6 8.55228 6 8Z" />
  </svg>
);

const IconUnSortSizeM = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" {...props}>
    <path d="M3 12C3 12.5523 3.44772 13 4 13H8C8.55228 13 9 12.5523 9 12C9 11.4477 8.55228 11 8 11H4C3.44772 11 3 11.4477 3 12ZM4 6C3.44772 6 3 6.44772 3 7C3 7.55228 3.44772 8 4 8H20C20.5523 8 21 7.55228 21 7C21 6.44772 20.5523 6 20 6H4ZM3 17C3 17.5523 3.44772 18 4 18H14C14.5523 18 15 17.5523 15 17C15 16.4477 14.5523 16 14 16H4C3.44772 16 3 16.4477 3 17Z" />
  </svg>
);

export const IconUnSort = createIcon({
  name: 'IconUnSort',
  xs: IconUnSortSizeXS,
  s: IconUnSortSizeS,
  m: IconUnSortSizeM,
  l: IconUnSortSizeM,
});
