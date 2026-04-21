import { createRouter, createRoute, createRootRoute, Outlet, redirect } from '@tanstack/react-router'
import { RootLayout }           from '@/app/layouts/RootLayout'
import { LoginPage }            from '@/pages/login'
import { KeysPage }             from '@/pages/keys'
import { ChangeRequestsPage }   from '@/pages/change-requests'
import { CoveragePage }         from '@/pages/coverage'
import { ImportExportPage }     from '@/pages/import-export'
import { UsersPage }            from '@/pages/users'

const rootRoute = createRootRoute({ component: () => <Outlet /> })

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => { throw redirect({ to: '/keys' }) },
})

const appLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_app',
  component: RootLayout,
})

const keysRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/keys',
  component: KeysPage,
})

const changeRequestsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/change-requests',
  component: ChangeRequestsPage,
})

const coverageRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/coverage',
  component: CoveragePage,
})

const importExportRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/import-export',
  component: ImportExportPage,
})

const usersRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/users',
  component: UsersPage,
})

const routeTree = rootRoute.addChildren([
  loginRoute,
  indexRoute,
  appLayoutRoute.addChildren([
    keysRoute,
    changeRequestsRoute,
    coverageRoute,
    importExportRoute,
    usersRoute,
  ]),
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register { router: typeof router }
}
