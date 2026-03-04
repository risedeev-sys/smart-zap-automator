import { Settings, LogOut } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { getAppSettings, saveAppSettings, type AppSettings } from "@/pages/ConfiguracoesPage";

interface TopbarProps {
  title: string;
}

export function Topbar({ title }: TopbarProps) {
  const { theme, toggleTheme } = useTheme();
  const [settings, setSettings] = useState<AppSettings>(getAppSettings);

  useEffect(() => {
    saveAppSettings(settings);
  }, [settings]);

  return (
    <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4 flex-shrink-0">
      <div className="flex items-center gap-3">
        <SidebarTrigger />
        <Separator orientation="vertical" className="h-5" />
        <h1 className="text-base font-semibold text-foreground">{title}</h1>
      </div>

      <div className="flex items-center gap-3">


        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Settings className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72" align="end">
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Configurações</h4>
              <Separator />
              <div className="flex items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <Label htmlFor="confirm-send" className="text-xs font-medium">
                    Confirmar antes de enviar
                  </Label>
                  <p className="text-[11px] text-muted-foreground leading-tight">
                    Pedir confirmação ao disparar ativos no Espaço de Teste.
                  </p>
                </div>
                <Switch
                  id="confirm-send"
                  checked={settings.confirmFunnelSend}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => ({ ...prev, confirmFunnelSend: checked }))
                  }
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Button variant="ghost" size="icon" className="h-8 w-8">
          <LogOut className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-2 pl-2 border-l border-border">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs bg-primary text-primary-foreground">RZ</AvatarFallback>
          </Avatar>
          <div className="hidden md:block">
            <p className="text-sm font-medium leading-none">Usuário</p>
            <p className="text-xs text-muted-foreground">+55 11 99999-9999</p>
          </div>
        </div>
      </div>
    </header>
  );
}
