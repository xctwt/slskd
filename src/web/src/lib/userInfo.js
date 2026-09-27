import * as users from './users';

// user info needs a peer connection per user, so lists of users load it a few
// at a time and remember the answers. requests nobody is waiting for any more
// are dropped before they start.
export const createInfoLoader = ({
  capacity = 250,
  concurrency = 4,
  fetch,
}) => {
  // username -> { promise, resolve, started, waiters }
  const entries = new Map();
  const queue = [];
  let active = 0;

  // forget the oldest answers once there are too many; pictures are big
  const trim = () => {
    for (const [username, entry] of entries) {
      if (entries.size <= capacity) {
        break;
      }

      if (entry.done) {
        entries.delete(username);
      }
    }
  };

  const run = async (username, entry) => {
    try {
      entry.resolve((await fetch(username)) ?? null);
    } catch {
      // try again next time someone asks
      entries.delete(username);
      entry.resolve(null);
    } finally {
      active -= 1;
      trim();
      pump(); // eslint-disable-line no-use-before-define
    }
  };

  const pump = () => {
    while (active < concurrency && queue.length > 0) {
      const username = queue.shift();
      const entry = entries.get(username);

      if (!entry || entry.started) {
        continue;
      }

      if (entry.waiters <= 0) {
        entries.delete(username);
        continue;
      }

      entry.started = true;
      active += 1;
      run(username, entry);
    }
  };

  // resolves to the user's info, or null if it couldn't be fetched. call
  // release once the answer is no longer wanted.
  const load = (username) => {
    let entry = entries.get(username);

    if (!entry) {
      entry = { done: false, started: false, waiters: 0 };
      entry.promise = new Promise((resolve) => {
        entry.resolve = (info) => {
          entry.done = true;
          resolve(info);
        };
      });
      entries.set(username, entry);
      queue.push(username);
    }

    entry.waiters += 1;
    pump();

    let released = false;

    return {
      promise: entry.promise,
      release: () => {
        if (!released) {
          released = true;
          entry.waiters -= 1;
        }
      },
    };
  };

  return { load };
};

// browsers allow six connections to a server at once
export const { load: loadInfo } = createInfoLoader({
  concurrency: 6,
  fetch: async (username) =>
    (await users.getInfo({ cached: true, username })).data,
});

// countries are looked up by the server without contacting the user, so more
// can run at once
export const { load: loadCountry } = createInfoLoader({
  concurrency: 8,
  fetch: (username) => users.getCountry({ username }),
});
