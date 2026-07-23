import { Suspense, lazy } from "react";
import { Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";

import { AuthProvider } from "@/lib/auth";
import { ThemeProvider } from "@/hooks/use-theme";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppShell } from "@/components/AppShell";

const AuthRoute = lazy(() => import("@/routes/auth"));
const DashboardRoute = lazy(() => import("@/routes/index"));
const AtivosRoute = lazy(() => import("@/routes/ativos"));
const AtivoDetailRoute = lazy(() => import("@/routes/ativos.$id"));
const TiposRoute = lazy(() => import("@/routes/tipos"));
const ColaboradoresRoute = lazy(() => import("@/routes/colaboradores"));
const MovimentacoesRoute = lazy(() => import("@/routes/movimentacoes"));
const ProblemasRoute = lazy(() => import("@/routes/problemas"));
const IndicadoresRoute = lazy(() => import("@/routes/indicadores"));
const KioskRoute = lazy(() => import("@/routes/kiosk"));
const KioskSetupRoute = lazy(() => import("@/routes/kiosk.setup"));
const UsuariosRoute = lazy(() => import("@/routes/usuarios"));

function PageFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
      Carregando…
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/auth" element={<AuthRoute />} />

            <Route
              path="/kiosk"
              element={
                <ProtectedRoute kioskRedirect>
                  <KioskRoute />
                </ProtectedRoute>
              }
            />

            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <DashboardRoute />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/ativos"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <AtivosRoute />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/ativos/:id"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <AtivoDetailRoute />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/tipos"
              element={
                <ProtectedRoute requireEdit>
                  <AppShell>
                    <TiposRoute />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/colaboradores"
              element={
                <ProtectedRoute requireEdit>
                  <AppShell>
                    <ColaboradoresRoute />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/movimentacoes"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <MovimentacoesRoute />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/problemas"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <ProblemasRoute />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/indicadores"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <IndicadoresRoute />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/kiosk/setup"
              element={
                <ProtectedRoute requireAdmin kioskRedirect={false}>
                  <AppShell>
                    <KioskSetupRoute />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/usuarios"
              element={
                <ProtectedRoute requireAdmin kioskRedirect={false}>
                  <AppShell>
                    <UsuariosRoute />
                  </AppShell>
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<AuthRoute />} />
          </Routes>
        </Suspense>
        <Toaster position="top-right" richColors closeButton />
      </AuthProvider>
    </ThemeProvider>
  );
}
