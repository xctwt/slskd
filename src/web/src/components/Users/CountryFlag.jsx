import React from 'react';
import { Flag } from 'semantic-ui-react';

const regionNames =
  typeof Intl.DisplayNames === 'function'
    ? new Intl.DisplayNames(undefined, { type: 'region' })
    : undefined;

export const getCountryName = (code) => {
  try {
    return regionNames?.of(code) ?? code;
  } catch {
    return code;
  }
};

// a little flag for an ISO 3166-1 alpha-2 code, as the server's GeoIP lookup
// returns them. codes semantic has no flag for render nothing.
const CountryFlag = ({ code }) => {
  if (!code) {
    return null;
  }

  const name = getCountryName(code);

  return (
    <Flag
      aria-label={name}
      name={code.toLowerCase()}
      role="img"
      title={name}
    />
  );
};

export default CountryFlag;
