import {
  countByTab,
  filterByTab,
  getCategory,
  sortUsers,
  summarize,
} from './transferView';

const file = (state, extra = {}) => ({
  bytesTransferred: 0,
  filename: `${state}.flac`,
  size: 100,
  state,
  ...extra,
});

const names = (users) => users.map((entry) => entry.username);

const user = (username, files) => ({
  directories: [{ directory: 'music', files }],
  username,
});

describe('getCategory', () => {
  it('groups states into tabs', () => {
    expect.assertions(8);

    expect(getCategory('InProgress')).toBe('active');
    expect(getCategory('Initializing')).toBe('active');
    expect(getCategory('Requested')).toBe('queued');
    expect(getCategory('Queued, Remotely')).toBe('queued');
    expect(getCategory('Completed, Succeeded')).toBe('succeeded');
    expect(getCategory('Completed, Cancelled')).toBe('cancelled');
    expect(getCategory('Completed, TimedOut')).toBe('failed');
    expect(getCategory('Completed, Rejected')).toBe('failed');
  });
});

describe('countByTab', () => {
  it('counts files in every tab', () => {
    expect.assertions(1);

    const users = [
      user('a', [file('Completed, Succeeded'), file('Queued, Locally')]),
      user('b', [file('Completed, Errored')]),
    ];

    expect(countByTab(users)).toEqual({
      active: 0,
      all: 3,
      cancelled: 0,
      failed: 1,
      queued: 1,
      succeeded: 1,
    });
  });
});

describe('filterByTab', () => {
  it('keeps only matching files and drops users without any', () => {
    expect.assertions(2);

    const users = [
      user('a', [file('Completed, Succeeded'), file('Completed, Errored')]),
      user('b', [file('Completed, Succeeded')]),
    ];

    const filtered = filterByTab(users, 'failed');

    expect(filtered.map((entry) => entry.username)).toEqual(['a']);
    expect(filtered[0].directories[0].files).toHaveLength(1);
  });

  it('returns everything for the all tab', () => {
    expect.assertions(1);

    const users = [user('a', [file('Completed, Succeeded')])];

    expect(filterByTab(users, 'all')).toBe(users);
  });
});

describe('summarize', () => {
  it('adds up counts, sizes and progress', () => {
    expect.assertions(4);

    const summary = summarize(
      user('a', [
        file('Completed, Succeeded', { bytesTransferred: 100 }),
        file('InProgress', {
          bytesTransferred: 50,
          requestedAt: '2026-09-27T10:00:00Z',
        }),
      ]),
    );

    expect(summary.counts).toMatchObject({ active: 1, all: 2, succeeded: 1 });
    expect(summary.size).toBe(200);
    expect(summary.progress).toBe(0.75);
    expect(summary.added).toBe(Date.parse('2026-09-27T10:00:00Z'));
  });
});

describe('sortUsers', () => {
  const users = [
    user('carol', [file('Completed, Succeeded', { size: 10 })]),
    user('alice', [file('Completed, Succeeded', { size: 30 })]),
    user('Bob', [file('Completed, Succeeded', { size: 20 })]),
  ];

  it('sorts by name, ignoring case', () => {
    expect.assertions(2);

    expect(names(sortUsers(users, 'name', false))).toEqual([
      'alice',
      'Bob',
      'carol',
    ]);
    expect(names(sortUsers(users, 'name', true))).toEqual([
      'carol',
      'Bob',
      'alice',
    ]);
  });

  it('sorts by size in either direction', () => {
    expect.assertions(2);

    expect(names(sortUsers(users, 'size', false))).toEqual([
      'carol',
      'Bob',
      'alice',
    ]);
    expect(names(sortUsers(users, 'size', true))).toEqual([
      'alice',
      'Bob',
      'carol',
    ]);
  });

  it('breaks ties by name', () => {
    expect.assertions(1);

    expect(names(sortUsers(users, 'files', true))).toEqual([
      'alice',
      'Bob',
      'carol',
    ]);
  });
});
