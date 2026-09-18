import { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router'
import Home from './pages/Home'
import PhotoDetail from './pages/PhotoDetail'
import Pricing from './pages/Pricing'
import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import VerifyEmail from './pages/VerifyEmail'
import AgencyDashboard, { AgencyLicenses, AgencyQuotes, AgencyTeam } from './pages/Agency'
import JoinAgency from './pages/JoinAgency'
import JoinModel from './pages/JoinModel'
import JoinPhotographer from './pages/JoinPhotographer'
import ModelPortal from './pages/Model'
import { ModelUpload } from './pages/ModelUpload'
import { ModelPhotoEdit } from './pages/ModelPhoto'
import {
  ContributorDashboard, ContributorEarnings, ContributorPortfolio, ContributorUpload,
} from './pages/Contributor'
import { ContributorPhotoEdit } from './pages/ContributorPhoto'
import {
  AdminDashboard, AdminModeration, AdminPayouts,
} from './pages/Admin'
import { AdminQuotes } from './pages/AdminQuotes'
import AdminRepresentation from './pages/AdminRepresentation'
import AdminPartnerKeys from './pages/AdminPartnerKeys'
import { AdminReports } from './pages/AdminReports'
import { AdminDmca } from './pages/AdminDmca'
import DmcaPage from './pages/Dmca'
import LegalPage from './pages/Legal'
import { AdminLegal } from './pages/AdminLegal'
import { AdminSettings } from './pages/AdminSettings'
import { AdminAdmins, AdminAgencies, AdminContributors, AdminInfluencers, AdminModels, AdminPhotographers, AdminUsers } from './pages/AdminAccounts'
import { AdminCountries, AdminRates } from './pages/AdminGeo'
import { AdminAiProviders, AdminGateways } from './pages/AdminIntegrations'
import { AdminContent } from './pages/AdminContent'
import Licenses from './pages/Licenses'
import Checkout from './pages/Checkout'
import PlusCheckout from './pages/PlusCheckout'
import Search from './pages/Search'
import Photographer from './pages/Photographer'
import ModelProfile from './pages/ModelProfile'
import BookCreator from './pages/BookCreator'
import Bookings from './pages/Bookings'
import Campaigns from './pages/Campaigns'
import Creators from './pages/Creators'
import Models from './pages/Models'
import Favorites from './pages/Favorites'
import Following from './pages/Following'
import Collections from './pages/Collections'
import CollectionDetail from './pages/CollectionDetail'
import Account from './pages/Account'
import NotFound from './pages/NotFound'
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
        <Route path="/search" element={<Search />} />
        <Route path="/p/:handle" element={<Photographer />} />
        <Route path="/m/:handle" element={<ModelProfile />} />
        <Route path="/creators" element={<Creators />} />
        <Route path="/models" element={<Models />} />
        <Route path="/hire/:handle" element={<BookCreator kind="photographer" />} />
        <Route path="/book/:handle" element={<BookCreator kind="model" />} />
        <Route path="/bookings" element={<ProtectedRoute allowed={['user', 'agency', 'photographer', 'photo_influencer', 'contributor', 'admin', 'model']}><Bookings /></ProtectedRoute>} />
        <Route path="/campaigns" element={<ProtectedRoute allowed={['user', 'agency', 'photographer', 'photo_influencer', 'contributor', 'admin']}><Campaigns /></ProtectedRoute>} />
        <Route path="/photo/:id" element={<PhotoDetail />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/dmca" element={<DmcaPage />} />
        <Route path="/dmca/:id" element={<DmcaPage />} />
        <Route path="/legal" element={<LegalPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route path="/verify-email/:token" element={<VerifyEmail />} />
        <Route path="/join/:token" element={<JoinAgency />} />
        <Route path="/invite/model/:token" element={<JoinModel />} />
        <Route path="/invite/photographer/:token" element={<JoinPhotographer />} />
        <Route path="/account" element={<ProtectedRoute allowed={['user', 'agency', 'photographer', 'photo_influencer', 'contributor', 'admin', 'model']}><Account /></ProtectedRoute>} />
        <Route path="/favorites" element={<ProtectedRoute allowed={['user', 'agency', 'photographer', 'photo_influencer', 'contributor', 'admin']}><Favorites /></ProtectedRoute>} />
        <Route path="/following" element={<ProtectedRoute allowed={['user', 'agency', 'photographer', 'photo_influencer', 'contributor', 'admin']}><Following /></ProtectedRoute>} />
        <Route path="/collections" element={<ProtectedRoute allowed={['user', 'agency', 'photographer', 'photo_influencer', 'contributor', 'admin']}><Collections /></ProtectedRoute>} />
        <Route path="/c/:id" element={<CollectionDetail />} />
        <Route path="/licenses" element={<ProtectedRoute allowed={['user', 'agency', 'photographer', 'photo_influencer', 'contributor', 'admin']}><Licenses /></ProtectedRoute>} />
        <Route path="/checkout/plus/:subscriptionId" element={<ProtectedRoute allowed={['user', 'agency', 'photographer', 'photo_influencer', 'contributor', 'admin']}><PlusCheckout /></ProtectedRoute>} />
        <Route path="/checkout/:paymentId" element={<ProtectedRoute allowed={['user', 'agency', 'photographer', 'photo_influencer', 'contributor', 'admin']}><Checkout /></ProtectedRoute>} />

        <Route path="/contributor" element={<ProtectedRoute allowed={['photographer', 'photo_influencer', 'contributor']}><ContributorDashboard /></ProtectedRoute>} />
        <Route path="/contributor/upload" element={<ProtectedRoute allowed={['photographer', 'photo_influencer', 'contributor']}><ContributorUpload /></ProtectedRoute>} />
        <Route path="/contributor/portfolio" element={<ProtectedRoute allowed={['photographer', 'photo_influencer', 'contributor']}><ContributorPortfolio /></ProtectedRoute>} />
        <Route path="/contributor/photos/:id" element={<ProtectedRoute allowed={['photographer', 'photo_influencer', 'contributor']}><ContributorPhotoEdit /></ProtectedRoute>} />
        <Route path="/contributor/earnings" element={<ProtectedRoute allowed={['photographer', 'photo_influencer', 'contributor']}><ContributorEarnings /></ProtectedRoute>} />

        <Route path="/agency" element={<ProtectedRoute allowed={['agency']}><AgencyDashboard /></ProtectedRoute>} />
        <Route path="/agency/team" element={<ProtectedRoute allowed={['agency']}><AgencyTeam /></ProtectedRoute>} />
        <Route path="/agency/licenses" element={<ProtectedRoute allowed={['agency']}><AgencyLicenses /></ProtectedRoute>} />
        <Route path="/agency/quotes" element={<ProtectedRoute allowed={['agency']}><AgencyQuotes /></ProtectedRoute>} />

        <Route path="/model" element={<ProtectedRoute allowed={['model']}><ModelPortal /></ProtectedRoute>} />
        <Route path="/model/upload" element={<ProtectedRoute allowed={['model']}><ModelUpload /></ProtectedRoute>} />
        <Route path="/model/photos/:id" element={<ProtectedRoute allowed={['model']}><ModelPhotoEdit /></ProtectedRoute>} />

        <Route path="/admin" element={<ProtectedRoute allowed={['admin']} capability="metrics.view"><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/users" element={<ProtectedRoute allowed={['admin']} capability="accounts.users.list"><AdminUsers /></ProtectedRoute>} />
        <Route path="/admin/photographers" element={<ProtectedRoute allowed={['admin']} capability="accounts.photographers.list"><AdminPhotographers /></ProtectedRoute>} />
        <Route path="/admin/influencers" element={<ProtectedRoute allowed={['admin']} capability="accounts.influencers.list"><AdminInfluencers /></ProtectedRoute>} />
        <Route path="/admin/contributors" element={<ProtectedRoute allowed={['admin']} capability="accounts.contributors.list"><AdminContributors /></ProtectedRoute>} />
        <Route path="/admin/agencies" element={<ProtectedRoute allowed={['admin']} capability="accounts.agencies.list"><AdminAgencies /></ProtectedRoute>} />
        <Route path="/admin/models" element={<ProtectedRoute allowed={['admin']} capability="accounts.models.list"><AdminModels /></ProtectedRoute>} />
        <Route path="/admin/admins" element={<ProtectedRoute allowed={['admin']} capability="accounts.admins.list"><AdminAdmins /></ProtectedRoute>} />
        <Route path="/admin/content" element={<ProtectedRoute allowed={['admin']} capability="content.list"><AdminContent /></ProtectedRoute>} />
        <Route path="/admin/moderation" element={<ProtectedRoute allowed={['admin']} capability="moderation.list"><AdminModeration /></ProtectedRoute>} />
        <Route path="/admin/reports" element={<ProtectedRoute allowed={['admin']} capability="reports.list"><AdminReports /></ProtectedRoute>} />
        <Route path="/admin/dmca" element={<ProtectedRoute allowed={['admin']} capability="dmca.manage"><AdminDmca /></ProtectedRoute>} />
        <Route path="/admin/quotes" element={<ProtectedRoute allowed={['admin']} capability="quotes.list"><AdminQuotes /></ProtectedRoute>} />
        <Route path="/admin/representation" element={<ProtectedRoute allowed={['admin']} capability="representation.list"><AdminRepresentation /></ProtectedRoute>} />
        <Route path="/admin/partner-api" element={<ProtectedRoute allowed={['admin']} capability="partner.keys.list"><AdminPartnerKeys /></ProtectedRoute>} />
        <Route path="/admin/payouts" element={<ProtectedRoute allowed={['admin']} capability="payouts.list"><AdminPayouts /></ProtectedRoute>} />
        <Route path="/admin/countries" element={<ProtectedRoute allowed={['admin']} capability="geo.countries.list"><AdminCountries /></ProtectedRoute>} />
        <Route path="/admin/legal" element={<ProtectedRoute allowed={['admin']} capability="geo.countries.list"><AdminLegal /></ProtectedRoute>} />
        <Route path="/admin/rates" element={<ProtectedRoute allowed={['admin']} capability="geo.fx.list"><AdminRates /></ProtectedRoute>} />
        <Route path="/admin/gateways" element={<ProtectedRoute allowed={['admin']} capability="integrations.gateways.read"><AdminGateways /></ProtectedRoute>} />
        <Route path="/admin/ai" element={<ProtectedRoute allowed={['admin']} capability="integrations.ai.read"><AdminAiProviders /></ProtectedRoute>} />
        <Route path="/admin/settings" element={<ProtectedRoute allowed={['admin']} capability="settings.read"><AdminSettings /></ProtectedRoute>} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  )
}
