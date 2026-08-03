import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'

import { queryClient, persistOptions } from '@/data/queryClient'
import { AuthProvider } from '@/data/supabase/auth'
import { watchSystemTheme } from '@/data/store/prefs'
import { ToastHost } from '@/design'

import { AppLayout } from './AppLayout'
import { PageFallback } from './PageFallback'

// Route-level splitting. The media page and collection detail are the heavy
// chunks — both pull in dnd-kit and the full detail query.
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'))
const LibraryPage = lazy(() => import('@/features/library/LibraryPage'))
const MediaPage = lazy(() => import('@/features/media/MediaPage'))
const CollectionsPage = lazy(() => import('@/features/collections/CollectionsPage'))
const CollectionDetailPage = lazy(() => import('@/features/collections/CollectionDetailPage'))
const DiscoverPage = lazy(() => import('@/features/discover/DiscoverPage'))
const ProfilePage = lazy(() => import('@/features/profile/ProfilePage'))
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'))
const AuthPage = lazy(() => import('@/features/auth/AuthPage'))

export function App() {
  useEffect(() => watchSystemTheme(), [])

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route
                index
                element={
                  <Suspense fallback={<PageFallback />}>
                    <DashboardPage />
                  </Suspense>
                }
              />
              <Route
                path="library"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <LibraryPage />
                  </Suspense>
                }
              />
              <Route
                path="media/:id"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <MediaPage />
                  </Suspense>
                }
              />
              <Route
                path="collections"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <CollectionsPage />
                  </Suspense>
                }
              />
              <Route
                path="collections/:id"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <CollectionDetailPage />
                  </Suspense>
                }
              />
              <Route
                path="discover"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <DiscoverPage />
                  </Suspense>
                }
              />
              <Route
                path="profile"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <ProfilePage />
                  </Suspense>
                }
              />
              <Route
                path="settings"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <SettingsPage />
                  </Suspense>
                }
              />
              <Route
                path="auth"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <AuthPage />
                  </Suspense>
                }
              />
              <Route path="*" element={<PageFallback notFound />} />
            </Route>
          </Routes>
        </BrowserRouter>
        <ToastHost />
      </AuthProvider>
    </PersistQueryClientProvider>
  )
}
