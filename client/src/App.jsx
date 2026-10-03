import React from 'react';
import { Routes, Route } from 'react-router-dom';
import MapPage from './components/MapPage.jsx';
import SmsInbox from './components/SmsInbox.jsx';
import AdminDashboard from './components/AdminDashboard.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<MapPage />} />
      <Route path="/sms" element={<SmsInbox />} />
      <Route path="/admin" element={<AdminDashboard />} />
    </Routes>
  );
}
