/**
 * Trigger Engine — Lógica compartilhada de avaliação de gatilhos.
 * 
 * Este módulo é a FONTE ÚNICA DE VERDADE para matching de gatilhos.
 * Usado pelo Simulador (frontend) e será usado pelo processamento 
 * de mensagens do WhatsApp (edge function) no futuro.
 * 
 * IMPORTANTE: Ao alterar a lógica aqui, tanto o simulador quanto
 * o disparo real serão afetados — que é exatamente o objetivo.
 */

export interface TriggerCondition {
  type: string;
  keywords: string[];
}

export interface TriggerData {
  id: string;
  name: string;
  enabled: boolean;
  conditions: TriggerCondition[];
  ignore_case: boolean;
  funnel_id: string | null;
  delay_seconds: number;
  send_to_groups: boolean;
  saved_contacts_only: boolean;
}

export interface ConditionMatch {
  type: string;
  keyword: string;
}

export interface TriggerMatchResult {
  triggerId: string;
  triggerName: string;
  matched: boolean;
  matchedConditions: ConditionMatch[];
  funnelId: string | null;
  delaySeconds: number;
}

/**
 * Avalia se uma única condição passa para a mensagem dada.
 * Retorna as keywords que deram match (se houver).
 */
function evaluateCondition(
  cond: TriggerCondition,
  normalizedMessage: string,
  ignoreCase: boolean
): { passed: boolean; matches: ConditionMatch[] } {
  const keywords = cond.keywords.map((k) => (ignoreCase ? k.toLowerCase() : k));
  const matches: ConditionMatch[] = [];

  switch (cond.type) {
    case "contém": {
      for (const kw of keywords) {
        if (normalizedMessage.includes(kw)) {
          matches.push({ type: cond.type, keyword: kw });
        }
      }
      return { passed: matches.length > 0, matches };
    }

    case "igual a": {
      for (const kw of keywords) {
        if (normalizedMessage === kw) {
          matches.push({ type: cond.type, keyword: kw });
        }
      }
      return { passed: matches.length > 0, matches };
    }

    case "começa com": {
      for (const kw of keywords) {
        if (normalizedMessage.startsWith(kw)) {
          matches.push({ type: cond.type, keyword: kw });
        }
      }
      return { passed: matches.length > 0, matches };
    }

    case "não contém": {
      const noneContained = keywords.every((kw) => !normalizedMessage.includes(kw));
      if (noneContained) {
        matches.push({ type: cond.type, keyword: "(nenhuma)" });
      }
      return { passed: noneContained, matches };
    }

    default:
      return { passed: false, matches: [] };
  }
}

/**
 * Avalia um único gatilho contra uma mensagem recebida.
 * TODAS as condições devem passar para o gatilho disparar (AND lógico).
 */
export function evaluateTrigger(trigger: TriggerData, message: string): TriggerMatchResult {
  const normalizedMessage = trigger.ignore_case ? message.toLowerCase() : message;
  const allMatches: ConditionMatch[] = [];
  let allPassed = true;

  for (const cond of trigger.conditions) {
    const { passed, matches } = evaluateCondition(cond, normalizedMessage, trigger.ignore_case);
    allMatches.push(...matches);
    if (!passed) {
      allPassed = false;
    }
  }

  return {
    triggerId: trigger.id,
    triggerName: trigger.name,
    matched: allPassed && trigger.conditions.length > 0,
    matchedConditions: allMatches,
    funnelId: trigger.funnel_id,
    delaySeconds: trigger.delay_seconds,
  };
}

/**
 * Avalia TODOS os gatilhos ativos contra uma mensagem.
 * Retorna apenas os que dispararam (matched = true).
 * 
 * Esta é a função principal que será chamada tanto pelo simulador
 * quanto pelo handler real de mensagens do WhatsApp.
 * 
 * @param triggers - Lista de todos os gatilhos do usuário
 * @param message - Mensagem recebida (texto)
 * @param options - Filtros opcionais (ex: isGroup, isSavedContact)
 */
export function findMatchingTriggers(
  triggers: TriggerData[],
  message: string,
  options?: {
    isGroup?: boolean;
    isSavedContact?: boolean;
  }
): TriggerMatchResult[] {
  const { isGroup = false, isSavedContact = true } = options ?? {};

  const activeTriggers = triggers.filter((t) => {
    if (!t.enabled) return false;
    // Filtrar por regras de grupo
    if (isGroup && !t.send_to_groups) return false;
    // Filtrar por contatos salvos
    if (t.saved_contacts_only && !isSavedContact) return false;
    return true;
  });

  const results = activeTriggers.map((t) => evaluateTrigger(t, message));
  return results.filter((r) => r.matched);
}
