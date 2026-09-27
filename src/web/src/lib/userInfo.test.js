import { createInfoLoader } from './userInfo';

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((_resolve, _reject) => {
    resolve = _resolve;
    reject = _reject;
  });
  return { promise, reject, resolve };
};

const setup = (options = {}) => {
  const pending = {};
  const fetch = jest.fn((username) => {
    pending[username] = deferred();
    return pending[username].promise;
  });

  return { fetch, pending, ...createInfoLoader({ fetch, ...options }) };
};

const flush = () =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

describe('createInfoLoader', () => {
  it('fetches each user once and shares the answer', async () => {
    expect.assertions(4);

    const { fetch, load, pending } = setup();

    const first = load('alice');
    const second = load('alice');
    pending.alice.resolve({ description: 'hi' });

    await expect(first.promise).resolves.toEqual({ description: 'hi' });
    await expect(second.promise).resolves.toEqual({ description: 'hi' });
    await expect(load('alice').promise).resolves.toEqual({ description: 'hi' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('runs no more than the concurrency limit at once', async () => {
    expect.assertions(2);

    const { fetch, load, pending } = setup({ concurrency: 2 });

    load('a');
    load('b');
    load('c');
    expect(fetch.mock.calls.map(([username]) => username)).toEqual(['a', 'b']);

    pending.a.resolve({});
    await flush();
    expect(fetch.mock.calls.map(([username]) => username)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('skips queued users nobody is waiting for', async () => {
    expect.assertions(1);

    const { fetch, load, pending } = setup({ concurrency: 1 });

    load('a');
    load('b').release();
    load('c');

    pending.a.resolve({});
    await flush();
    expect(fetch.mock.calls.map(([username]) => username)).toEqual(['a', 'c']);
  });

  it('resolves null on failure and retries next time', async () => {
    expect.assertions(2);

    const { fetch, load, pending } = setup();

    const failed = load('alice');
    pending.alice.reject(new Error('offline'));
    await expect(failed.promise).resolves.toBeNull();
    await flush();

    load('alice');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('forgets the oldest answers beyond its capacity', async () => {
    expect.assertions(1);

    const { fetch, load, pending } = setup({ capacity: 1 });

    load('a');
    pending.a.resolve({});
    await flush();
    load('b');
    pending.b.resolve({});
    await flush();

    load('a');
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
