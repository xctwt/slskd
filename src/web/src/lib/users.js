import api from './api';

// cached accepts an answer (or failure) from the last few minutes, and gives
// up on users who don't answer within a few seconds; it suits lists of users
export const getInfo = ({ username, cached = false }) => {
  return api.get(`/users/${encodeURIComponent(username)}/info`, {
    params: cached ? { cached } : undefined,
  });
};

export const getStatus = ({ username }) => {
  return api.get(`/users/${encodeURIComponent(username)}/status`);
};

export const getEndpoint = ({ username }) => {
  return api.get(`/users/${encodeURIComponent(username)}/endpoint`);
};

export const browse = async ({ username }) => {
  return (await api.get(`/users/${encodeURIComponent(username)}/browse`)).data;
};

export const getBrowseStatus = ({ username }) => {
  return api.get(`/users/${encodeURIComponent(username)}/browse/status`);
};

export const getDirectoryContents = async ({ username, directory }) => {
  return (
    await api.post(`/users/${encodeURIComponent(username)}/directory`, {
      directory,
    })
  ).data;
};

export const getStatistics = ({ username }) => {
  return api.get(`/users/${encodeURIComponent(username)}/statistics`);
};

export const getGroup = async ({ username }) => {
  return (await api.get(`/users/${encodeURIComponent(username)}/group`)).data;
};

export const grantPrivileges = ({ username, days }) => {
  return api.post(`/users/${encodeURIComponent(username)}/privileges`, {
    days,
  });
};

export const getInterests = async ({ username }) => {
  return (await api.get(`/users/${encodeURIComponent(username)}/interests`))
    .data;
};

// the uppercase ISO 3166-1 code of the country the user's IP address is in, or
// undefined if it isn't known
export const getCountry = async ({ username }) => {
  return (
    (await api.get(`/users/${encodeURIComponent(username)}/country`)).data ||
    undefined
  );
};

// the user groups each user is in, by username: the groups defined in the config
// (a group named "buddies", say), not built-in ones such as leechers
export const groupsByUser = (options) => {
  const groups = new Map();

  for (const [name, group] of Object.entries(
    options?.transfers?.groups?.userDefined ?? {},
  )) {
    for (const member of group?.members ?? []) {
      groups.set(member, [...(groups.get(member) ?? []), name]);
    }
  }

  return groups;
};

// the names of the user groups defined in the config
export const userGroupNames = (options) =>
  Object.keys(options?.transfers?.groups?.userDefined ?? {});
