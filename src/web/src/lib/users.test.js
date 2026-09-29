import { groupsByUser, userGroupNames } from './users';

const options = {
  transfers: {
    groups: {
      userDefined: {
        buddies: { members: ['alice', 'bob'] },
        empty: {},
        friends: { members: ['bob', 'carol'] },
      },
    },
  },
};

describe('groupsByUser', () => {
  it('lists the user-defined groups each user is in', () => {
    const groups = groupsByUser(options);

    expect(groups.get('alice')).toEqual(['buddies']);
    expect(groups.get('bob')).toEqual(['buddies', 'friends']);
    expect(groups.get('carol')).toEqual(['friends']);
    expect(groups.has('dave')).toBe(false);
  });

  it('is empty without options or groups', () => {
    expect(groupsByUser(undefined).size).toBe(0);
    expect(groupsByUser({ transfers: {} }).size).toBe(0);
  });
});

describe('userGroupNames', () => {
  it('lists the user-defined groups', () => {
    expect(userGroupNames(options)).toEqual(['buddies', 'empty', 'friends']);
    expect(userGroupNames(undefined)).toEqual([]);
  });
});
