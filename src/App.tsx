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
            <Route path="/" element={<Index />} />
            <Route path="/mensagens" element={<MensagensPage />} />
            <Route path="/audios" element={<AudiosPage />} />
            <Route path="/midias" element={<MidiasPage />} />
            <Route path="/documentos" element={<DocumentosPage />} />
            <Route path="/funis" element={<FunisPage />} />
            <Route path="/gatilhos" element={<GatilhosPage />} />
            <Route path="/backups" element={<BackupsPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
      </AssetsProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
