import * as db from '@/data/mockDb';

function sortByKey(items, sortKey) {
  if (!sortKey) return [...items];
  return [...items].sort((a, b) => {
    const av = a?.[sortKey] ?? 0;
    const bv = b?.[sortKey] ?? 0;
    return av < bv ? -1 : av > bv ? 1 : 0;
  });
}

function filterItems(items, filterObj) {
  if (!filterObj || Object.keys(filterObj).length === 0) return [...items];
  return items.filter((item) => {
    return Object.entries(filterObj).every(([k, v]) => {
      if (v === undefined || v === null || v === '') return true;
      return item?.[k] === v;
    });
  });
}

function makeEntityAccess(listGetter) {
  return {
    list: async (sortKey) => sortByKey(listGetter(), sortKey),
    filter: async (filterObj, sortKey) => {
      const filtered = filterItems(listGetter(), filterObj);
      return sortByKey(filtered, sortKey);
    },
  };
}

export const base44 = {
  auth: {
    // Return null by default (no auth outside Base44)
    me: async () => null,
    logout: () => {},
    redirectToLogin: () => {
      alert('Login is not implemented yet. This is a local prototype.');
    },
  },
  entities: {
    Subject: makeEntityAccess(() => db.subjects),
    Topic: makeEntityAccess(() => db.topics),
    Category: makeEntityAccess(() => db.categories),
    Exercise: makeEntityAccess(() => db.exercises),
    UserProgress: makeEntityAccess(() => db.userProgress),
  },
};
