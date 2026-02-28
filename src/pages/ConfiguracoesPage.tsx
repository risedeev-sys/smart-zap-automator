import { MainLayout } from "@/components/layout/MainLayout";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { FlaskConical } from "lucide-react";
import { useEffect, useState } from "react";

const SETTINGS_KEY = "risezap_settings";

export interface AppSettings {
  confirmFunnelSend: boolean;
}

export function getAppSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { confirmFunnelSend: true, ...JSON.parse(raw) };
  } catch {}
  return { confirmFunnelSend: true };
}

export function saveAppSettings(settings: AppSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export default function ConfiguracoesPage() {
  const [settings, setSettings] = useState<AppSettings>(getAppSettings);

  useEffect(() => {
    saveAppSettings(settings);
  }, [settings]);

  return (
    <MainLayout title="Configurações">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Espaço de Teste */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <FlaskConical className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Espaço de Teste</h2>
          </div>
          <Separator className="mb-4" />

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="confirm-funnel" className="text-sm font-medium">
                Confirmação antes de enviar funil
              </Label>
              <p className="text-xs text-muted-foreground">
                Exibe um diálogo de confirmação sempre que um funil for disparado no Espaço de Teste.
              </p>
            </div>
            <Switch
              id="confirm-funnel"
              checked={settings.confirmFunnelSend}
              onCheckedChange={(checked) =>
                setSettings((prev) => ({ ...prev, confirmFunnelSend: checked }))
              }
            />
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}
