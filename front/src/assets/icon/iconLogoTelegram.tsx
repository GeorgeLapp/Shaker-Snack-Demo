import { SVGProps } from 'react';
import { createIcon } from '@consta/icons/Icon';

const IconLogoTelegramSizeL = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40" {...props}>
    <g clipPath="url(#clip0_16540_43843)">
      <path
        d="M20 39.25C30.6315 39.25 39.25 30.6315 39.25 20C39.25 9.36852 30.6315 0.75 20 0.75C9.36852 0.75 0.75 9.36852 0.75 20C0.75 30.6315 9.36852 39.25 20 39.25Z"
        fill="url(#paint0_linear_16540_43843)"
      />
      <path
        d="M29.6066 12.0371C29.7779 10.9296 28.7249 10.0554 27.7401 10.4877L8.12662 19.0991C7.42044 19.4092 7.4721 20.4789 8.20452 20.7121L12.2493 22.0002C13.0213 22.2461 13.8572 22.1189 14.5313 21.6532L23.6506 15.3529C23.9256 15.1629 24.2254 15.5539 23.9904 15.7961L17.4261 22.5638C16.7894 23.2204 16.9157 24.3329 17.6817 24.8132L25.0311 29.4219C25.8554 29.9388 26.9158 29.4196 27.07 28.4234L29.6066 12.0371Z"
        fill="white"
      />
    </g>
    <defs>
      <linearGradient
        id="paint0_linear_16540_43843"
        x1="20"
        y1="0.75"
        x2="20"
        y2="39.25"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#37BBFE" />
        <stop offset="1" stopColor="#007DBB" />
      </linearGradient>
      <clipPath id="clip0_16540_43843">
        <rect width="40" height="40" fill="white" />
      </clipPath>
    </defs>
  </svg>
);

export const IconLogoTelegram = createIcon({
  name: 'IconLogoTelegram',
  m: IconLogoTelegramSizeL,
  s: IconLogoTelegramSizeL,
  xs: IconLogoTelegramSizeL,
  l: IconLogoTelegramSizeL,
});
