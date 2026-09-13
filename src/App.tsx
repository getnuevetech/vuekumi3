import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router';
import Home from './pages/Home';
import PhotoDetail from './pages/PhotoDetail';
import Pricing from './pages/Pricing';
import Login from './pages/Login';
import {
  ContributorDashboard, ContributorEarnings, ContributorPortfolio, ContributorUpload,
} from './pages/Contributor';
import {
  AdminDashboard, AdminModeration, AdminPayouts, AdminUsers,
} from './pages/Admin';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        {/* public marketplace */}
        <Route path="/" element={<Home />} />
        <Route path="/photo/:id" element={<PhotoDetail />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/login" element={<Login />} />

        {/* contributor portal */}
        <Route path="/contributor" element={<ContributorDashboard />} />
        <Route path="/contributor/upload" element={<ContributorUpload />} />
        <Route path="/contributor/portfolio" element={<ContributorPortfolio />} />
        <Route path="/contributor/earnings" element={<ContributorEarnings />} />

        {/* admin portal */}
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/moderation" element={<AdminModeration />} />
        <Route path="/admin/users" element={<AdminUsers />} />
        <Route path="/admin/payouts" element={<AdminPayouts />} />

        <Route path="*" element={<Home />} />
      </Routes>
    </>
  );
}
