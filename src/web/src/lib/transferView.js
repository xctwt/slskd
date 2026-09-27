import { getFileName } from './util';

// what a transfer's state means for someone scanning the list
export const getCategory = (state = '') => {
  switch (state) {
    case 'InProgress':
    case 'Initializing':
      return 'active';
    case 'Completed, Succeeded':
      return 'succeeded';
    case 'Completed, Cancelled':
      return 'cancelled';
    default:
      return state.includes('Completed') ? 'failed' : 'queued';
  }
};

export const tabs = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'In progress' },
  { key: 'queued', label: 'Queued' },
  { key: 'succeeded', label: 'Completed' },
  { key: 'failed', label: 'Errored' },
  { key: 'cancelled', label: 'Cancelled' },
];

export const sortOptions = [
  { key: 'added', label: 'Date added' },
  { key: 'name', label: 'Username' },
  { key: 'progress', label: 'Progress' },
  { key: 'size', label: 'Size' },
  { key: 'files', label: 'Files' },
];

const getFiles = (user) =>
  (user.directories ?? []).flatMap((directory) => directory.files ?? []);

const emptyCounts = () => ({
  active: 0,
  all: 0,
  cancelled: 0,
  failed: 0,
  queued: 0,
  succeeded: 0,
});

// the number of files in each tab, across all users
export const countByTab = (users) => {
  const counts = emptyCounts();

  for (const file of users.flatMap(getFiles)) {
    counts.all += 1;
    counts[getCategory(file.state)] += 1;
  }

  return counts;
};

// the users with files in the tab, keeping only those files
export const filterByTab = (users, tab) => {
  if (tab === 'all') {
    return users;
  }

  return users
    .map((user) => ({
      ...user,
      directories: (user.directories ?? [])
        .map((directory) => ({
          ...directory,
          files: (directory.files ?? []).filter(
            (file) => getCategory(file.state) === tab,
          ),
        }))
        .filter((directory) => directory.files.length > 0),
    }))
    .filter((user) => user.directories.length > 0);
};

const toTime = (value) => {
  const time = value ? Date.parse(value) : Number.NaN;
  return Number.isNaN(time) ? 0 : time;
};

// counts, sizes and progress for one user's row
export const summarize = (user) => {
  const counts = emptyCounts();
  let size = 0;
  let transferred = 0;
  let added = 0;

  for (const file of getFiles(user)) {
    counts.all += 1;
    counts[getCategory(file.state)] += 1;
    size += file.size ?? 0;
    transferred += file.bytesTransferred ?? 0;
    added = Math.max(added, toTime(file.requestedAt ?? file.enqueuedAt));
  }

  return {
    added,
    counts,
    progress: size > 0 ? transferred / size : 0,
    size,
    transferred,
  };
};

const compareName = (a, b) =>
  a.username.localeCompare(b.username, undefined, { sensitivity: 'base' });

const sortValues = {
  added: (summary) => summary.added,
  files: (summary) => summary.counts.all,
  progress: (summary) => summary.progress,
  size: (summary) => summary.size,
};

// sorts users by the given key, breaking ties by username
export const sortUsers = (users, sortBy, descending) => {
  const direction = descending ? -1 : 1;
  const value = sortValues[sortBy];

  return users
    .map((user) => ({ summary: summarize(user), user }))
    .sort((a, b) => {
      const difference = value
        ? value(a.summary) - value(b.summary)
        : compareName(a.user, b.user);

      return difference * direction || compareName(a.user, b.user);
    })
    .map(({ user }) => user);
};

// files in a folder, in name order
export const sortFiles = (files) =>
  [...files].sort((a, b) =>
    getFileName(a.filename).localeCompare(getFileName(b.filename)),
  );
