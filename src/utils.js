// Simple helper to build routes similar to Base44's createPageUrl

const ROUTES = {
  Home: '/',
  Grades: '/grades',
  Topics: '/topics',
  Categories: '/categories',
  Exercises: '/exercises',
  Play: '/play',
  Profile: '/profile',
  Typing: '/typing',
};

export function createPageUrl(page) {
  if (!page) return '/';

  // Already a path
  if (page.startsWith('/')) return page;

  // Accept strings like "Exercises?topic=..."
  const [name, query] = page.split('?');
  const base = ROUTES[name] ?? `/${String(name).toLowerCase()}`;
  return query ? `${base}?${query}` : base;
}
