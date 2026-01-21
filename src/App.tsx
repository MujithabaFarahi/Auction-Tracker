import { Navigate, Route, Routes } from "react-router-dom";

import AdminLayout from "@/components/admin/AdminLayout";
import RequireAdmin from "@/components/admin/RequireAdmin";
import AuctionViewPage from "@/pages/AuctionViewPage";
import AuctionPlayerPage from "@/pages/AuctionPlayerPage";
import AuctionTeamPage from "@/pages/AuctionTeamPage";
import AuctionPage from "@/pages/admin/AuctionPage";
import LoginPage from "@/pages/admin/LoginPage";
import SetupPage from "@/pages/admin/SetupPage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/auction/view" replace />} />
      <Route path="/auction/view" element={<AuctionViewPage />} />
      <Route path="/auction/teams/:teamId" element={<AuctionTeamPage />} />
      <Route path="/auction/players/:playerId" element={<AuctionPlayerPage />} />
      <Route path="/admin/login" element={<LoginPage />} />
      <Route
        path="/admin"
        element={
          <RequireAdmin>
            <AdminLayout />
          </RequireAdmin>
        }
      >
        <Route index element={<Navigate to="/admin/setup" replace />} />
        <Route path="setup" element={<SetupPage />} />
        <Route path="auction" element={<AuctionPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/auction/view" replace />} />
    </Routes>
  );
}

export default App;
