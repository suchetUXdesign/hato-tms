export const ROUTES = {
  LOGIN:          '/login',
  KEYS:           '/keys',
  CHANGE_REQUESTS: '/change-requests',
  CR_DETAIL:      (id: string) => `/change-requests/${id}`,
  COVERAGE:       '/coverage',
  IMPORT_EXPORT:  '/import-export',
  USERS:          '/users',
} as const
