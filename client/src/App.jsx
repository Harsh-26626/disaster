import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';

function Home() {
  return (
    <div className="page-container">
      <h1>Disaster Intelligence Platform</h1>
      <p>Interactive Map & Live Citizen Response Portal (Chunk 0 Foundation Ready)</p>
      <nav style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
        <Link to="/">Map View</Link>
        <Link to="/sms">SMS Inbox</Link>
        <Link to="/admin">Admin Portal</Link>
      </nav>
    </div>
  );
}

function SmsInbox() {
  return (
    <div className="page-container">
      <h1>Emergency SMS Inbox</h1>
      <p>Simulated Government Broadcasts</p>
      <Link to="/">← Back to Map</Link>
    </div>
  );
}

function AdminPortal() {
  return (
    <div className="page-container">
      <h1>Admin Dashboard</h1>
      <p>Official Feeds, Rescue Queue, Report Verification</p>
      <Link to="/">← Back to Map</Link>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/sms" element={<SmsInbox />} />
      <Route path="/admin" element={<AdminPortal />} />
    </Routes>
  );
}
