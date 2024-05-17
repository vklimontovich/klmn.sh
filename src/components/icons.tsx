export type LogoOpts = {
  mono?: boolean;
};

export const JitsuLogo: React.FC<LogoOpts> = ({ mono }) => {
  return (
    <svg width="100%" height="100%" viewBox="0 0 87 87" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="43.5" cy="43.5" r="43.5" fill={mono ? "currentColor" : "#AA00FF"}></circle>
      <path
        d="M60 44.9221C59.9986 49.1858 58.3012 53.2744 55.2809 56.2893C52.2606 59.3042 48.1647 60.9986 43.8934 61H27V44.9221H43.8934V26H60V44.9221Z"
        fill="white"
      ></path>
    </svg>
  );
};

export const GetIntentLogo: React.FC = () => {
  return (
    <svg viewBox="0 0 61 69" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M57.59 33.1893L46.32 44.4893C48.4958 42.3089 49.7177 39.3545 49.7177 36.2743C49.7177 33.194 48.4958 30.2396 46.32 28.0593L24.79 6.48929L27.86 3.40929C28.9358 2.33047 30.2138 1.47453 31.6209 0.890503C33.028 0.30648 34.5365 0.00585938 36.06 0.00585938C37.5835 0.00585938 39.0921 0.30648 40.4992 0.890503C41.9063 1.47453 43.1843 2.33047 44.26 3.40929L57.59 16.7593C59.7658 18.9396 60.9877 21.894 60.9877 24.9743C60.9877 28.0545 59.7658 31.0089 57.59 33.1893Z"
        fill="#0070C1"
      />
      <path
        d="M14.65 40.2799L36.15 61.7799L33.08 64.8499C32.0053 65.9269 30.7287 66.7814 29.3234 67.3644C27.918 67.9474 26.4115 68.2475 24.89 68.2475C23.3685 68.2475 21.862 67.9474 20.4566 67.3644C19.0513 66.7814 17.7747 65.9269 16.7 64.8499L3.39 51.5399C1.21973 49.3668 0.000732422 46.4211 0.000732422 43.3499C0.000732422 40.2787 1.21973 37.333 3.39 35.1599L14.65 23.9199C12.4858 26.0922 11.2707 29.0336 11.2707 32.0999C11.2707 35.1663 12.4858 38.1076 14.65 40.2799Z"
        fill="#2A3239"
      />
      <path
        d="M14.65 46.4202C12.4797 48.5933 11.2607 51.539 11.2607 54.6102C11.2607 57.6814 12.4797 60.6271 14.65 62.8002L3.39 51.5402C1.21973 49.3671 0.000732422 46.4214 0.000732422 43.3502C0.000732422 40.279 1.21973 37.3333 3.39 35.1602L16.7 21.8502C18.8731 19.6799 21.8188 18.4609 24.89 18.4609C27.9612 18.4609 30.9069 19.6799 33.08 21.8502L36.15 24.9202L14.65 46.4202Z"
        fill="#515960"
      />
      <path
        d="M57.59 33.1885L44.26 46.5485C43.1836 47.6261 41.9054 48.481 40.4984 49.0643C39.0913 49.6476 37.5832 49.9478 36.06 49.9478C34.5369 49.9478 33.0287 49.6476 31.6217 49.0643C30.2147 48.481 28.9364 47.6261 27.86 46.5485L24.79 43.4685L46.32 21.9185C48.4964 19.7365 49.7186 16.7804 49.7186 13.6985C49.7186 10.6166 48.4964 7.66056 46.32 5.47852L57.59 16.7785C59.7597 18.958 60.9778 21.9082 60.9778 24.9835C60.9778 28.0589 59.7597 31.009 57.59 33.1885Z"
        fill="#00AEFF"
      />
    </svg>
  );
};

export const TwitterLogo: React.FC<LogoOpts> = ({ mono }) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="126.444 2.281 589 589">
      <circle cx="420.944" cy="296.781" r="294.5" fill={mono ? "currentColor" : "#2daae1"} />
      <path
        d="M609.773 179.634c-13.891 6.164-28.811 10.331-44.498 12.204 16.01-9.587 28.275-24.779 34.066-42.86a154.78 154.78 0 0 1-49.209 18.801c-14.125-15.056-34.267-24.456-56.551-24.456-42.773 0-77.462 34.675-77.462 77.473 0 6.064.683 11.98 1.996 17.66-64.389-3.236-121.474-34.079-159.684-80.945-6.672 11.446-10.491 24.754-10.491 38.953 0 26.875 13.679 50.587 34.464 64.477a77.122 77.122 0 0 1-35.097-9.686v.979c0 37.54 26.701 68.842 62.145 75.961-6.511 1.784-13.344 2.716-20.413 2.716-4.998 0-9.847-.473-14.584-1.364 9.859 30.769 38.471 53.166 72.363 53.799-26.515 20.785-59.925 33.175-96.212 33.175-6.25 0-12.427-.373-18.491-1.104 34.291 21.988 75.006 34.824 118.759 34.824 142.496 0 220.428-118.052 220.428-220.428 0-3.361-.074-6.697-.236-10.021a157.855 157.855 0 0 0 38.707-40.158z"
        fill="#fff"
      />
    </svg>
  );
};

export const LinkedInLogo: React.FC = () => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="5 5 39 39">
      <path
        fill="#0288D1"
        d="M42,37c0,2.762-2.238,5-5,5H11c-2.761,0-5-2.238-5-5V11c0-2.762,2.239-5,5-5h26c2.762,0,5,2.238,5,5V37z"
      ></path>
      <path
        fill="#FFF"
        d="M12 19H17V36H12zM14.485 17h-.028C12.965 17 12 15.888 12 14.499 12 13.08 12.995 12 14.514 12c1.521 0 2.458 1.08 2.486 2.499C17 15.887 16.035 17 14.485 17zM36 36h-5v-9.099c0-2.198-1.225-3.698-3.192-3.698-1.501 0-2.313 1.012-2.707 1.99C24.957 25.543 25 26.511 25 27v9h-5V19h5v2.616C25.721 20.5 26.85 19 29.738 19c3.578 0 6.261 2.25 6.261 7.274L36 36 36 36z"
      ></path>
    </svg>
  );
};

export const TelegramLogo: React.FC<LogoOpts> = ({ mono }) => {
  return (
    <svg
      id="Livello_1"
      data-name="Livello 1"
      xmlns="http://www.w3.org/2000/svg"
      height="100%"
      width="100%"
      viewBox="0 0 240 240"
    >
      <defs>
        <linearGradient id="linear-gradient" x1="120" y1="240" x2="120" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#1d93d2" />
          <stop offset="1" stopColor="#38b0e3" />
        </linearGradient>
      </defs>
      <title>Telegram_logo</title>
      <circle cx="120" cy="120" r="120" fill={mono ? "currentColor" : "url(#linear-gradient)"} />
      <path
        d="M81.229,128.772l14.237,39.406s1.78,3.687,3.686,3.687,30.255-29.492,30.255-29.492l31.525-60.89L81.737,118.6Z"
        fill="#c8daea"
      />
      <path d="M100.106,138.878l-2.733,29.046s-1.144,8.9,7.754,0,17.415-15.763,17.415-15.763" fill="#a9c6d8" />
      <path
        d="M81.486,130.178,52.2,120.636s-3.5-1.42-2.373-4.64c.232-.664.7-1.229,2.1-2.2,6.489-4.523,120.106-45.36,120.106-45.36s3.208-1.081,5.1-.362a2.766,2.766,0,0,1,1.885,2.055,9.357,9.357,0,0,1,.254,2.585c-.009.752-.1,1.449-.169,2.542-.692,11.165-21.4,94.493-21.4,94.493s-1.239,4.876-5.678,5.043A8.13,8.13,0,0,1,146.1,172.5c-8.711-7.493-38.819-27.727-45.472-32.177a1.27,1.27,0,0,1-.546-.9c-.093-.469.417-1.05.417-1.05s52.426-46.6,53.821-51.492c.108-.379-.3-.566-.848-.4-3.482,1.281-63.844,39.4-70.506,43.607A3.21,3.21,0,0,1,81.486,130.178Z"
        fill="#fff"
      />
    </svg>
  );
};

export const FacebookLogo: React.FC = () => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="100%" height="100%" viewBox="0 0 48 48">
      <linearGradient
        id="Ld6sqrtcxMyckEl6xeDdMa_uLWV5A9vXIPu_gr1"
        x1="9.993"
        x2="40.615"
        y1="9.993"
        y2="40.615"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0" stopColor="#2aa4f4"></stop>
        <stop offset="1" stopColor="#007ad9"></stop>
      </linearGradient>
      <path
        fill="url(#Ld6sqrtcxMyckEl6xeDdMa_uLWV5A9vXIPu_gr1)"
        d="M24,4C12.954,4,4,12.954,4,24s8.954,20,20,20s20-8.954,20-20S35.046,4,24,4z"
      ></path>
      <path
        fill="#fff"
        d="M26.707,29.301h5.176l0.813-5.258h-5.989v-2.874c0-2.184,0.714-4.121,2.757-4.121h3.283V12.46 c-0.577-0.078-1.797-0.248-4.102-0.248c-4.814,0-7.636,2.542-7.636,8.334v3.498H16.06v5.258h4.948v14.452 C21.988,43.9,22.981,44,24,44c0.921,0,1.82-0.084,2.707-0.204V29.301z"
      ></path>
    </svg>
  );
};

export const YCombinatorLogo: React.FC = () => {
  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 256 256"
      version="1.1"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid"
    >
      <g>
        <rect fill="#FB651E" x="0" y="0" width="256" height="256"></rect>
        <path
          d="M119.373653,144.745813 L75.43296,62.4315733 L95.5144533,62.4315733 L121.36192,114.52416 C121.759575,115.452022 122.2235,116.413008 122.753707,117.407147 C123.283914,118.401285 123.747838,119.428546 124.145493,120.48896 C124.410597,120.886615 124.609422,121.251127 124.741973,121.582507 C124.874525,121.913886 125.007075,122.212123 125.139627,122.477227 C125.802386,123.802744 126.39886,125.095105 126.929067,126.354347 C127.459274,127.613589 127.923198,128.773399 128.320853,129.833813 C129.381268,127.580433 130.541078,125.1614 131.80032,122.57664 C133.059562,119.99188 134.351922,117.307747 135.67744,114.52416 L161.92256,62.4315733 L180.612267,62.4315733 L136.27392,145.739947 L136.27392,198.826667 L119.373653,198.826667 L119.373653,144.745813 Z"
          fill="#FFFFFF"
        ></path>
      </g>
    </svg>
  );
};

export const GithubLogo: React.FC<LogoOpts> = ({ mono }) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="2 2 20 20">
      <path
        d="M10.9,2.1c-4.6,0.5-8.3,4.2-8.8,8.7c-0.5,4.7,2.2,8.9,6.3,10.5C8.7,21.4,9,21.2,9,20.8v-1.6c0,0-0.4,0.1-0.9,0.1 c-1.4,0-2-1.2-2.1-1.9c-0.1-0.4-0.3-0.7-0.6-1C5.1,16.3,5,16.3,5,16.2C5,16,5.3,16,5.4,16c0.6,0,1.1,0.7,1.3,1c0.5,0.8,1.1,1,1.4,1 c0.4,0,0.7-0.1,0.9-0.2c0.1-0.7,0.4-1.4,1-1.8c-2.3-0.5-4-1.8-4-4c0-1.1,0.5-2.2,1.2-3C7.1,8.8,7,8.3,7,7.6c0-0.4,0-0.9,0.2-1.3 C7.2,6.1,7.4,6,7.5,6c0,0,0.1,0,0.1,0C8.1,6.1,9.1,6.4,10,7.3C10.6,7.1,11.3,7,12,7s1.4,0.1,2,0.3c0.9-0.9,2-1.2,2.5-1.3 c0,0,0.1,0,0.1,0c0.2,0,0.3,0.1,0.4,0.3C17,6.7,17,7.2,17,7.6c0,0.8-0.1,1.2-0.2,1.4c0.7,0.8,1.2,1.8,1.2,3c0,2.2-1.7,3.5-4,4 c0.6,0.5,1,1.4,1,2.3v2.6c0,0.3,0.3,0.6,0.7,0.5c3.7-1.5,6.3-5.1,6.3-9.3C22,6.1,16.9,1.4,10.9,2.1z"
        fill={mono ? "currentColor" : "black"}
      ></path>
    </svg>
  );
};

export const NotionLogo: React.FC = () => {
  return (
    <svg width="100%" height="100%" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M6.017 4.313l55.333 -4.087c6.797 -0.583 8.543 -0.19 12.817 2.917l17.663 12.443c2.913 2.14 3.883 2.723 3.883 5.053v68.243c0 4.277 -1.553 6.807 -6.99 7.193L24.467 99.967c-4.08 0.193 -6.023 -0.39 -8.16 -3.113L3.3 79.94c-2.333 -3.113 -3.3 -5.443 -3.3 -8.167V11.113c0 -3.497 1.553 -6.413 6.017 -6.8z"
        fill="#fff"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M61.35 0.227l-55.333 4.087C1.553 4.7 0 7.617 0 11.113v60.66c0 2.723 0.967 5.053 3.3 8.167l13.007 16.913c2.137 2.723 4.08 3.307 8.16 3.113l64.257 -3.89c5.433 -0.387 6.99 -2.917 6.99 -7.193V20.64c0 -2.21 -0.873 -2.847 -3.443 -4.733L74.167 3.143c-4.273 -3.107 -6.02 -3.5 -12.817 -2.917zM25.92 19.523c-5.247 0.353 -6.437 0.433 -9.417 -1.99L8.927 11.507c-0.77 -0.78 -0.383 -1.753 1.557 -1.947l53.193 -3.887c4.467 -0.39 6.793 1.167 8.54 2.527l9.123 6.61c0.39 0.197 1.36 1.36 0.193 1.36l-54.933 3.307 -0.68 0.047zM19.803 88.3V30.367c0 -2.53 0.777 -3.697 3.103 -3.893L86 22.78c2.14 -0.193 3.107 1.167 3.107 3.693v57.547c0 2.53 -0.39 4.67 -3.883 4.863l-60.377 3.5c-3.493 0.193 -5.043 -0.97 -5.043 -4.083zm59.6 -54.827c0.387 1.75 0 3.5 -1.75 3.7l-2.91 0.577v42.773c-2.527 1.36 -4.853 2.137 -6.797 2.137 -3.107 0 -3.883 -0.973 -6.21 -3.887l-19.03 -29.94v28.967l6.02 1.363s0 3.5 -4.857 3.5l-13.39 0.777c-0.39 -0.78 0 -2.723 1.357 -3.11l3.497 -0.97v-38.3L30.48 40.667c-0.39 -1.75 0.58 -4.277 3.3 -4.473l14.367 -0.967 19.8 30.327v-26.83l-5.047 -0.58c-0.39 -2.143 1.163 -3.7 3.103 -3.89l13.4 -0.78z"
        fill="#000"
      />
    </svg>
  );
};
