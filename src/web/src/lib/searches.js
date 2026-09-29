import api from './api';

export * from './searchFilters';

export const getAll = async () => {
  return (await api.get('/searches')).data;
};

export const stop = ({ id }) => {
  return api.put(`/searches/${encodeURIComponent(id)}`);
};

export const remove = ({ id }) => {
  return api.delete(`/searches/${encodeURIComponent(id)}`);
};

export const create = ({ id, searchText }) => {
  return api.post('/searches', { id, searchText });
};

export const getStatus = async ({ id, includeResponses = false }) => {
  return (
    await api.get(
      `/searches/${encodeURIComponent(id)}?includeResponses=${includeResponses}`,
    )
  ).data;
};

export const getResponses = async ({ id }) => {
  const response = (
    await api.get(`/searches/${encodeURIComponent(id)}/responses`)
  ).data;

  if (!Array.isArray(response)) {
    console.warn('got non-array response from searches API', response);
    return undefined;
  }

  return response;
};

// deletes every finished search; searches still running are kept
export const removeAll = async () => (await api.delete('/searches')).data;

// the server silently drops searches for some artists after copyright
// complaints, without telling clients which, so a search that ran its course
// with nobody answering is the only sign of it
export const isUnanswered = (search) =>
  Boolean(search?.isComplete) &&
  (search.responseCount ?? 0) === 0 &&
  !/Cancelled|Errored/u.test(search.state ?? '');

export const unansweredMessage =
  'Nobody answered. The Soulseek server silently drops searches for some artists, usually after copyright complaints, and this looks like one. Try without the artist name, e.g. the album title and a track name.';
