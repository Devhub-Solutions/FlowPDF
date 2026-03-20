import './index.css';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import LandingPage from './pages/LandingPage';
import RenderPage from './pages/RenderPage';
import BuilderPage from './pages/BuilderPage';
import MergePage from './pages/MergePage';
import GuidePage from './pages/GuidePage';
import ApiDocsPage from './pages/ApiDocsPage';
import LookupPage from './pages/LookupPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route element={<AppLayout />}>
        <Route path="/render" element={<RenderPage />} />
        <Route path="/builder" element={<BuilderPage />} />
        <Route path="/merge" element={<MergePage />} />
        <Route path="/lookup" element={<LookupPage />} />
      </Route>
      <Route path="/guide" element={<GuidePage />} />
      <Route path="/api-docs" element={<ApiDocsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
