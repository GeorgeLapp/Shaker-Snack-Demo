import { SVGProps } from 'react';
import { createIcon } from '@consta/icons/Icon';

const IconSaveSizeXS = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" {...props}>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M2.25 1C1.55964 1 1 1.55964 1 2.25V9.75C1 10.4404 1.55964 11 2.25 11H9.75C10.4404 11 11 10.4404 11 9.75V4.01777C11 3.68625 10.8683 3.3683 10.6339 3.13388L8.86612 1.36612C8.6317 1.1317 8.31376 1 7.98223 1H2.25ZM7.98223 2H2V4.01777H7.98223V2ZM5.5 9C6.32843 9 7 8.32843 7 7.5C7 6.67157 6.32843 6 5.5 6C4.67157 6 4 6.67157 4 7.5C4 8.32843 4.67157 9 5.5 9Z"
    />
  </svg>
);

const IconSaveSizeS = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" {...props}>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M2.75 1C1.7835 1 1 1.7835 1 2.75V13.25C1 14.2165 1.7835 15 2.75 15H13.25C14.2165 15 15 14.2165 15 13.25V5.22487C15 4.76074 14.8156 4.31563 14.4874 3.98744L12.0126 1.51256C11.6844 1.18437 11.2393 1 10.7751 1H2.75ZM11 3H3V5H11V3ZM8 12C9.10457 12 10 11.1046 10 10C10 8.89543 9.10457 8 8 8C6.89543 8 6 8.89543 6 10C6 11.1046 6.89543 12 8 12Z"
    />
  </svg>
);

const IconSaveSizeM = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" {...props}>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M4.875 2.5C3.56332 2.5 2.5 3.56332 2.5 4.875V19.125C2.5 20.4367 3.56332 21.5 4.875 21.5H19.125C20.4367 21.5 21.5 20.4367 21.5 19.125V8.23376C21.5 7.60387 21.2498 6.99978 20.8044 6.55438L17.4456 3.19562C17.0002 2.75022 16.3961 2.5 15.7662 2.5H4.875ZM4.4 4.4V8.2H15.8V4.4H4.4ZM12 17.7C13.574 17.7 14.85 16.424 14.85 14.85C14.85 13.276 13.574 12 12 12C10.426 12 9.15 13.276 9.15 14.85C9.15 16.424 10.426 17.7 12 17.7Z"
    />
  </svg>
);

export const IconSave = createIcon({
  name: 'IconSave',
  s: IconSaveSizeS,
  m: IconSaveSizeM,
  xs: IconSaveSizeXS,
  l: IconSaveSizeM,
});
