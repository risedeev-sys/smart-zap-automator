// Converts Zap Voice backup format to Rise Zap format

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isZapVoiceFormat(data: any): boolean {
  return !!(
    data.messages ||
    data.docs ||
    (data.funnels?.length && data.funnels[0]?.itemsSequence) ||
    (data.triggers?.length && data.triggers[0]?.keywordRules)
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function convertAssets(items: any[] | undefined): any[] {
  if (!items) return [];
  return items.map((item) => ({
    ...item,
    favorite: item.isFavorite ?? false,
    isFavorite: undefined,
  }));
}

const typeMap: Record<string, string> = {
  message: "mensagem",
  media: "midia",
  audio: "audio",
  doc: "documento",
};

const conditionTypeMap: Record<string, string> = {
  contains: "contém",
  equals: "igual a",
  startsWith: "começa com",
  endsWith: "termina com",
};

function msToDelay(ms: number): { delayMin: number; delaySec: number } {
  const totalSec = Math.round(ms / 1000);
  return { delayMin: Math.floor(totalSec / 60), delaySec: totalSec % 60 };
}

function msToDelayText(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  if (totalSec === 0) return "0 segundos";
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  const parts: string[] = [];
  if (min > 0) parts.push(`${min} minuto${min > 1 ? "s" : ""}`);
  if (sec > 0) parts.push(`${sec} segundo${sec > 1 ? "s" : ""}`);
  return parts.join(" e ");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function detectAndConvertZapVoice(data: any): { converted: any; wasZapVoice: boolean } {
  if (!isZapVoiceFormat(data)) {
    return { converted: data, wasZapVoice: false };
  }

  // Build funnelId -> name map for trigger resolution
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const funnelNameMap: Record<string, string> = {};
  if (data.funnels) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const f of data.funnels) {
      funnelNameMap[f.id] = f.name;
    }
  }

  const converted: Record<string, unknown> = {
    version: data.version ?? 1,
    createdAt: data.createdAt ?? new Date().toISOString(),
    mensagens: convertAssets(data.messages),
    audios: convertAssets(data.audios),
    midias: convertAssets(data.medias),
    documentos: convertAssets(data.docs),
  };

  // Convert funnels
  if (data.funnels) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    converted.funis = data.funnels.map((funnel: any) => ({
      id: funnel.id,
      name: funnel.name,
      favorite: funnel.isFavorite ?? false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      items: (funnel.itemsSequence || []).map((seq: any) => ({
        id: crypto.randomUUID(),
        type: typeMap[seq.type] || seq.type,
        assetId: seq.itemId,
        ...msToDelay(seq.delayBeforeSend || 0),
      })),
    }));
  }

  // Convert triggers
  if (data.triggers) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    converted.gatilhos = data.triggers.map((trigger: any) => ({
      id: trigger.id,
      name: trigger.name,
      enabled: trigger.isEnabled ?? true,
      favorite: trigger.isFavorite ?? false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      conditions: (trigger.keywordRules || []).map((rule: any) => ({
        type: conditionTypeMap[rule.type] || rule.type,
        keywords: rule.keywords || [],
      })),
      funnelName: funnelNameMap[trigger.funnelId] || "",
      delay: msToDelayText(trigger.millisecondsBeforeSend || 0),
      sendToGroups: trigger.sendToGroups ?? false,
      savedContactsOnly: !(trigger.sendToContacts ?? true),
      ignoreCase: !(trigger.isCaseSensitive ?? false),
    }));
  }

  return { converted, wasZapVoice: true };
}
