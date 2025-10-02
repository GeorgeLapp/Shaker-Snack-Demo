import { SVGProps } from 'react';
import { createIcon } from '@consta/icons/Icon';

const IconCommentAddFilledSizeXS = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" {...props}>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M10.0004 9C10.5527 9 11 8.55228 11 8V2C11 1.44772 10.5523 1 10 1H2C1.44772 1 1 1.44686 1 1.99914V11L3 9H10.0004ZM5.5 2.5V4.5H3.5V5.5H5.5V7.5H6.5V5.5H8.5V4.5H6.5V2.5H5.5Z"
    />
  </svg>
);

const IconCommentAddFilledSizeS = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" {...props}>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M14 11C14 11.5523 13.5534 12 13.0012 12H4.16667L2 14V3.99625C2 3.44397 2.44772 3 3 3H13C13.5523 3 14 3.44772 14 4V11ZM7.5 5V7H5.5V8H7.5V10H8.5V8H10.5V7H8.5V5H7.5Z"
    />
  </svg>
);

const IconCommentAddFilledSizeM = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" {...props}>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M4 2H20C21.1 2 22 2.9 22 4V16C22 17.1 21.1 18 20 18H6L2 22V4C2 2.9 2.9 2 4 2ZM11 5V9H7V11H11V15H13V11H17V9H13V5H11Z"
    />
  </svg>
);

export const IconCommentAddFilled = createIcon({
  name: 'IconCommentAddFilled',
  s: IconCommentAddFilledSizeS,
  m: IconCommentAddFilledSizeM,
  xs: IconCommentAddFilledSizeXS,
  l: IconCommentAddFilledSizeM,
});
