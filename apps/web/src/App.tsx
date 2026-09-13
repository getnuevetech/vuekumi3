import { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router'
import Home from './pages/Home'
import PhotoDetail from './pages/PhotoDetail'
import Pricing from './pages/Pricing'
import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import VerifyEmail from './pages/VerifyEmail'
import AgencyDashboard from './pages/Agency'
import {
  ContributorDashboard, ContributorEarnings, ContributorPortfolio, ContributorUpload,
} from './pages/Contributor'
import {
  AdminDashboard, AdminModeration, AdminPayouts,
} from './pages/Admin'
import { AdminSettings } from './pages/AdminSettings'
import { AdminAdmins, AdminAgencies, AdminContributors, AdminUsers } from './pages/AdminAccounts'
import { AdminCountries, AdminRates } from './pages/AdminGeo'
import { AdminAiProviders, AdminGateways } from './pages/AdminIntegrations'
import { AdminContent } from './pages/AdminContent'
import Licenses from './pages/Licenses'
import { ProtectedRoute } from './guards/ProtectedRoute'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/photo/:id" element={<PhotoDetail />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route path="/verify-email/:token" element={<VerifyEmail />} />
        <Route path="/licenses" element={<ProtectedRoute allowed={['user', 'agency', 'contributor', 'admin']}><Licenses /></ProtectedRoute>} />

        <Route path="/contributor" element={<ProtectedRoute allowed={['contributor', 'admin']}><ContributorDashboard /></ProtectedRoute>} />
        <Route path="/contributor/upload" element={<ProtectedRoute allowed={['contributor', 'admin']}><ContributorUpload /></ProtectedRoute>} />
        <Route path="/contributor/portfolio" element={<ProtectedRoute allowed={['contributor', 'admin']}><ContributorPortfolio /></ProtectedRoute>} />
        <Route path="/contributor/earnings" element={<ProtectedRoute allowed={['contributor', 'admin']}><ContributorEarnings /></ProtectedRoute>} />

        <Route path="/agency" element={<ProtectedRoute allowed={['agency']}><AgencyDashboard /></ProtectedRoute>} />

        <Route path="/admin" element={<ProtectedRoute allowed={['admin']}><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/users" element={<ProtectedRoute allowed={['admin']}><AdminUsers /></ProtectedRoute>} />
        <Route path="/admin/contributors" element={<ProtectedRoute allowed={['admin']}><AdminContributors /></ProtectedRoute>} />
        <Route path="/admin/agencies" element={<ProtectedRoute allowed={['admin']}><AdminAgencies /></ProtectedRoute>} />
        <Route path="/admin/admins" element={<ProtectedRoute allowed={['admin']}><AdminAdmins /></ProtectedRoute>} />
        <Route path="/admin/content" element={<ProtectedRoute allowed={['admin']}><AdminContent /></ProtectedRoute>} />
        <Route path="/admin/moderation" element={<ProtectedRoute allowed={['admin']}><AdminModeration /></ProtectedRoute>} />
        <Route path="/admin/payouts" element={<ProtectedRoute allowed={['admin']}><AdminPayouts /></ProtectedRoute>} />
        <Route path="/admin/countries" element={<ProtectedRoute allowed={['admin']}><AdminCountries /></ProtectedRoute>} />
        <Route path="/admin/rates" element={<ProtectedRoute allowed={['admin']}><AdminRates /></ProtectedRoute>} />
        <Route path="/admin/gateways" element={<ProtectedRoute allowed={['admin']}><AdminGateways /></ProtectedRoute>} />
        <Route path="/admin/ai" element={<ProtectedRoute allowed={['admin']}><AdminAiProviders /></ProtectedRoute>} />
        <Route path="/admin/settings" element={<ProtectedRoute allowed={['admin']}><AdminSettings /></ProtectedRoute>} />

        <Route path="*" element={<Home />} />
      </Routes>
    </>
  )
}
