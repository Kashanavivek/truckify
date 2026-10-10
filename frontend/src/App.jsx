import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import Footer from './components/Footer';

import Home from './pages/Home';
import Trucks from './pages/Trucks';
import TruckDetail from './pages/TruckDetail';
import Login from './pages/Login';
import Register from './pages/Register';
import CustomerBookings from './pages/CustomerBookings';
import BookingDetail from './pages/BookingDetail';
import Notifications from './pages/Notifications';
import NotFound from './pages/NotFound';

import OwnerDashboard from './pages/owner/OwnerDashboard';
import OwnerTruckForm from './pages/owner/OwnerTruckForm';
import OwnerTruckManage from './pages/owner/OwnerTruckManage';
import OwnerBookings from './pages/owner/OwnerBookings';
import OwnerCalendar from './pages/owner/OwnerCalendar';
import OwnerEarnings from './pages/owner/OwnerEarnings';

import AdminDashboard from './pages/admin/AdminDashboard';
import AdminApprovals from './pages/admin/AdminApprovals';
import AdminTrucks from './pages/admin/AdminTrucks';
import AdminBookings from './pages/admin/AdminBookings';
import AdminUsers from './pages/admin/AdminUsers';

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <div className="flex min-h-screen flex-col">
            <Navbar />
            <main className="flex-1">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/trucks" element={<Trucks />} />
                <Route path="/trucks/:id" element={<TruckDetail />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />

                {/* customer */}
                <Route path="/my-bookings" element={<ProtectedRoute roles={['customer']}><CustomerBookings /></ProtectedRoute>} />
                <Route path="/bookings/:id" element={<ProtectedRoute roles={['customer', 'owner', 'admin']}><BookingDetail /></ProtectedRoute>} />
                <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />

                {/* owner */}
                <Route path="/owner" element={<ProtectedRoute roles={['owner']}><OwnerDashboard /></ProtectedRoute>} />
                <Route path="/owner/new" element={<ProtectedRoute roles={['owner']}><OwnerTruckForm /></ProtectedRoute>} />
                <Route path="/owner/trucks/:id" element={<ProtectedRoute roles={['owner']}><OwnerTruckManage /></ProtectedRoute>} />
                <Route path="/owner/bookings" element={<ProtectedRoute roles={['owner']}><OwnerBookings /></ProtectedRoute>} />
                <Route path="/owner/calendar" element={<ProtectedRoute roles={['owner']}><OwnerCalendar /></ProtectedRoute>} />
                <Route path="/owner/earnings" element={<ProtectedRoute roles={['owner']}><OwnerEarnings /></ProtectedRoute>} />

                {/* admin */}
                <Route path="/admin" element={<ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>} />
                <Route path="/admin/approvals" element={<ProtectedRoute roles={['admin']}><AdminApprovals /></ProtectedRoute>} />
                <Route path="/admin/trucks" element={<ProtectedRoute roles={['admin']}><AdminTrucks /></ProtectedRoute>} />
                <Route path="/admin/bookings" element={<ProtectedRoute roles={['admin']}><AdminBookings /></ProtectedRoute>} />
                <Route path="/admin/users" element={<ProtectedRoute roles={['admin']}><AdminUsers /></ProtectedRoute>} />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </main>
            <Footer />
          </div>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
