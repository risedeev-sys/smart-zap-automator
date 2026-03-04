import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AssetsProvider } from "@/contexts/AssetsContext";
import Index from "./pages/Index";
import MensagensPage from "./pages/MensagensPage";
import AudiosPage from "./pages/AudiosPage";
import MidiasPage from "./pages/MidiasPage";
import DocumentosPage from "./pages/DocumentosPage";
import FunisPage from "./pages/FunisPage";
import GatilhosPage from "./pages/GatilhosPage";
import BackupsPage from "./pages/BackupsPage";

import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import ApiKeysPage from "./pages/ApiKeysPage";
import ProtectedRoute from "./components/ProtectedRoute";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AssetsProvider>
        <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/mensagens" element={<ProtectedRoute><MensagensPage /></ProtectedRoute>} />
            <Route path="/audios" element={<ProtectedRoute><AudiosPage /></ProtectedRoute>} />
            <Route path="/midias" element={<ProtectedRoute><MidiasPage /></ProtectedRoute>} />
            <Route path="/documentos" element={<ProtectedRoute><DocumentosPage /></ProtectedRoute>} />
            <Route path="/funis" element={<ProtectedRoute><FunisPage /></ProtectedRoute>} />
            <Route path="/gatilhos" element={<ProtectedRoute><GatilhosPage /></ProtectedRoute>} />
            <Route path="/backups" element={<ProtectedRoute><BackupsPage /></ProtectedRoute>} />
            
            <Route path="/api-keys" element={<ProtectedRoute><ApiKeysPage /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
      </AssetsProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
