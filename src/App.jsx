import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import AppLayout from './components/layout/AppLayout';

import Dashboard from './pages/Dashboard';
import Bookings from './pages/Bookings';
import Inquiries from './pages/Inquiries';
import Offers from './pages/Offers';
import Departures from './pages/Departures';
import Pricing from './pages/Pricing';
import Communications from './pages/Communications';
import QuibiSettings from './pages/QuibiSettings';
import FareHarborLog from './pages/FareHarborLog';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-4 border-[#1a5c38]/20 border-t-[#1a5c38] rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') return <UserNotRegisteredError />;
    if (authError.type === 'auth_required') { navigateToLogin(); return null; }
  }

  return (
    <Routes>
      <Route path="/" element={<AppLayout><Dashboard /></AppLayout>} />
      <Route path="/bookings" element={<AppLayout><Bookings /></AppLayout>} />
      <Route path="/inquiries" element={<AppLayout><Inquiries /></AppLayout>} />
      <Route path="/offers" element={<AppLayout><Offers /></AppLayout>} />
      <Route path="/departures" element={<AppLayout><Departures /></AppLayout>} />
      <Route path="/pricing" element={<AppLayout><Pricing /></AppLayout>} />
      <Route path="/communications" element={<AppLayout><Communications /></AppLayout>} />
      <Route path="/settings/quibi" element={<AppLayout><QuibiSettings /></AppLayout>} />
      <Route path="/settings/fareharbor" element={<AppLayout><FareHarborLog /></AppLayout>} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;