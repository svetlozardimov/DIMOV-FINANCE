import { GoogleGenAI } from "@google/genai";
import { AppState, PartnerFinancials, FinancialSummary } from '../types';
import { PARTNERS } from '../constants';

const getClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateReport = async (
  state: AppState,
  summary: FinancialSummary,
  partnerStats: PartnerFinancials[],
  promptText: string = ""
): Promise<string> => {
  const ai = getClient();

  // Prepare a condensed context for the AI
  const contextData = {
    date: new Date().toISOString().split('T')[0],
    summary: {
      totalRevenue: summary.totalRevenue,
      totalExpenses: summary.totalExpenses,
      profitBeforeTax: summary.taxableProfit,
      corporateTax: summary.corporateTax,
      netProfit: summary.netProfit
    },
    partners: partnerStats.map(p => ({
      name: p.name,
      revenueGenerated: p.revenue,
      netAvailable: p.netProfitShare,
      dividendsTaken: p.dividendsTakenGross,
      currentBalance: p.balance
    })),
    recentActivity: {
      lastPayments: state.payments.slice(-5).map(p => ({ date: p.date, amount: p.totalAmount, desc: p.description })),
      lastExpenses: state.expenses.slice(-5).map(e => ({ date: e.date, amount: e.amount, cat: e.category }))
    }
  };

  const systemPrompt = `
    Ти си опитен финансов директор на малка семейна фирма в България. 
    Твоята задача е да анализираш предоставените финансови данни (в JSON формат) и да генерираш кратък, професионален текстов доклад на български език.
    
    Докладът трябва да включва:
    1. Общ преглед на състоянието на фирмата (Приходи vs Разходи).
    2. Анализ на ефективността на съдружниците (Кой генерира най-много приходи).
    3. Данъчни задължения (Наблегни на корпоративния данък).
    4. Препоръки за разпределение на дивиденти, ако има натрупана голяма печалба.
    
    Използвай официален, но разбираем език. Форматирай текста с Markdown (bold, lists).
  `;

  const userPrompt = `
    Данни за фирмата:
    \`\`\`json
    ${JSON.stringify(contextData, null, 2)}
    \`\`\`
    
    Допълнителен въпрос от потребителя: ${promptText || "Моля, направи стандартен месечен отчет."}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        thinkingConfig: { thinkingBudget: 0 } // Disable thinking for faster response on standard text
      }
    });

    return response.text || "Неуспешно генериране на отчет.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Възникна грешка при връзката с AI услугата. Моля, проверете API ключа.";
  }
};