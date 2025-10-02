import { SVGProps } from 'react';
import { createIcon } from '@consta/icons/Icon';

const IconWatchStrokedSizeXS = (props: SVGProps<SVGSVGElement>) => (
  <svg width="12" height="12" viewBox="0 0 12 12" {...props}>
    <g clipPath="url(#clip0_28723_2542)">
      <path d="M5 2.5C5 2.22386 5.22386 2 5.5 2C5.77614 2 6 2.22386 6 2.5V5.48857C6 5.6517 6.07958 5.80457 6.21321 5.89814L8.38112 7.41613C8.60732 7.57452 8.6623 7.88629 8.50391 8.1125C8.34552 8.3387 8.03374 8.39367 7.80754 8.23528L5.21321 6.41871C5.07958 6.32514 5 6.17226 5 6.00913V2.5Z" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 6C12 9.31371 9.31371 12 6 12C2.68629 12 0 9.31371 0 6C0 2.68629 2.68629 0 6 0C9.31371 0 12 2.68629 12 6ZM11 6C11 8.76142 8.76142 11 6 11C3.23858 11 1 8.76142 1 6C1 3.23858 3.23858 1 6 1C8.76142 1 11 3.23858 11 6Z"
      />
    </g>
    <defs>
      <clipPath id="clip0_28723_2542">
        <rect width="12" height="12" fill="white" />
      </clipPath>
    </defs>
  </svg>
);

const IconWatchStrokedSizeS = (props: SVGProps<SVGSVGElement>) => (
  <svg width="16" height="16" viewBox="0 0 16 16" {...props}>
    <g clipPath="url(#clip0_28723_2560)">
      <path d="M9.45021 7.79633C9.16918 7.61135 9 7.29746 9 6.96102V4C9 3.44772 8.55229 3 8 3C7.44772 3 7 3.44772 7 4V8.00642C7 8.34067 7.167 8.65282 7.44505 8.83831L10.1893 10.669C10.6399 10.9696 11.2482 10.8552 11.5588 10.4114C11.8808 9.95132 11.7593 9.31618 11.2903 9.00744L9.45021 7.79633Z" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M16 8C16 12.4183 12.4183 16 8 16C3.58167 16 0 12.4183 0 8C0 3.58173 3.58167 0 8 0C12.4183 0 16 3.58173 16 8ZM14 8C14 11.3137 11.3137 14 8 14C4.68628 14 2 11.3137 2 8C2 4.68629 4.68628 2 8 2C11.3137 2 14 4.68629 14 8Z"
      />
    </g>
    <defs>
      <clipPath id="clip0_28723_2560">
        <rect width="16" height="16" fill="white" />
      </clipPath>
    </defs>
  </svg>
);

const IconWatchStrokedSizeM = (props: SVGProps<SVGSVGElement>) => (
  <svg width="24" height="24" viewBox="0 0 24 24" {...props}>
    <path d="M13.4265 12.2573C13.1592 12.0701 13 11.7644 13 11.438V7C13 6.44772 12.5523 6 12 6C11.4477 6 11 6.44772 11 7V12.4793C11 12.8057 11.1592 13.1114 11.4265 13.2986L15.1808 15.9265C15.6332 16.2433 16.2568 16.1332 16.5735 15.6808C16.8902 15.2283 16.7802 14.6048 16.3277 14.2881L13.4265 12.2573Z" />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M22 12C22 17.5228 17.5228 22 12 22C6.47717 22 2 17.5228 2 12C2 6.47716 6.47717 2 12 2C17.5228 2 22 6.47716 22 12ZM20 12C20 16.4183 16.4183 20 12 20C7.58167 20 4 16.4183 4 12C4 7.58173 7.58167 4 12 4C16.4183 4 20 7.58173 20 12Z"
    />
  </svg>
);

export const IconWatchStroked = createIcon({
  name: 'IconWatchStroked',
  xs: IconWatchStrokedSizeXS,
  s: IconWatchStrokedSizeS,
  m: IconWatchStrokedSizeM,
  l: IconWatchStrokedSizeM,
});
