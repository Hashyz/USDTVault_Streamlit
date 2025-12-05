import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AppSidebar from "@/components/AppSidebar";
import WalletConnect from "@/components/WalletConnect";
import ThemeToggle from "@/components/ThemeToggle";
import Dashboard from "@/pages/Dashboard";
import Login from "@/pages/Login";
import SavingsGoals from "@/pages/SavingsGoals";
import Transactions from "@/pages/Transactions";
import InvestmentPlans from "@/pages/InvestmentPlans";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/not-found";
import { useAuth } from "@/hooks/useAuth";
import { Web3Provider } from "@/contexts/Web3Context";

function AuthenticatedLayout({ children, user }: { children: React.ReactNode; user: any }) {
  const style = {
    '--sidebar-width': '16rem',
    '--sidebar-width-icon': '3rem',
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between p-3 sm:p-4 border-b bg-background">
            <SidebarTrigger data-testid="button-sidebar-toggle" className="md:hidden" />
            <div className="hidden md:block">
              <SidebarTrigger data-testid="button-sidebar-toggle-desktop" />
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <WalletConnect user={user} />
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-auto p-4 sm:p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function Router() {
  const { isAuthenticated, isLoading, user } = useAuth();
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }
  
  return (
    <Switch>
      <Route path="/login">
        {() => isAuthenticated ? <Redirect to="/" /> : <Login />}
      </Route>
      <Route path="/">
        {() => isAuthenticated ? (
          <AuthenticatedLayout user={user}>
            <Dashboard />
          </AuthenticatedLayout>
        ) : (
          <Redirect to="/login" />
        )}
      </Route>
      <Route path="/goals">
        {() => isAuthenticated ? (
          <AuthenticatedLayout user={user}>
            <SavingsGoals />
          </AuthenticatedLayout>
        ) : (
          <Redirect to="/login" />
        )}
      </Route>
      <Route path="/transactions">
        {() => isAuthenticated ? (
          <AuthenticatedLayout user={user}>
            <Transactions />
          </AuthenticatedLayout>
        ) : (
          <Redirect to="/login" />
        )}
      </Route>
      <Route path="/plans">
        {() => isAuthenticated ? (
          <AuthenticatedLayout user={user}>
            <InvestmentPlans />
          </AuthenticatedLayout>
        ) : (
          <Redirect to="/login" />
        )}
      </Route>
      <Route path="/settings">
        {() => isAuthenticated ? (
          <AuthenticatedLayout user={user}>
            <Settings />
          </AuthenticatedLayout>
        ) : (
          <Redirect to="/login" />
        )}
      </Route>
      <Route>
        {() => isAuthenticated ? (
          <AuthenticatedLayout user={user}>
            <NotFound />
          </AuthenticatedLayout>
        ) : (
          <NotFound />
        )}
      </Route>
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Web3Provider>
          <Router />
        </Web3Provider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}