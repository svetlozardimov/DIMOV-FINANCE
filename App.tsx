import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Wallet, 
  Receipt, 
  Users, 
  FileText, 
  Settings, 
  Trash2, 
  Download, 
  Upload, 
  TrendingUp, 
  Briefcase,
  HardHat, 
  Zap,
  CheckCircle2,
  PieChart
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';

import { 
  AppState, 
  Project, 
  Payment, 
  Expense, 
  DividendPayout, 
  PartnerFinancials, 
  FinancialSummary 
} from './types';
import { PARTNERS, INITIAL_STATE, EXPENSE_CATEGORIES, TAX_RATE, DIVIDEND_TAX_RATE } from './constants';
import { FinancialCard } from './components/FinancialCard';
import { generateReport } from './services/geminiService';

// --- Utility Functions ---

const calculateFinancials = (state: AppState): { summary: FinancialSummary, partnerStats: PartnerFinancials[] } => {
  const totalRevenue = state.payments.reduce((sum, p) => sum + p.totalAmount, 0);
  const totalExpenses = state.expenses.reduce((sum, e) => sum + e.amount, 0);
  
  const taxableProfit = Math.max(0, totalRevenue - totalExpenses);
  const corporateTax = taxableProfit * TAX_RATE;
  const netProfit = totalRevenue - totalExpenses - corporateTax;

  // Calculate expense share per partner based on specific expense distributions
  const partnerExpenseMap: Record<string, number> = {};
  PARTNERS.forEach(p => partnerExpenseMap[p.id] = 0);

  state.expenses.forEach(exp => {
    if (!exp.distributions || exp.distributions.length === 0) {
      // Fallback: split equally if no distribution data
      const share = exp.amount / PARTNERS.length;
      PARTNERS.forEach(p => partnerExpenseMap[p.id] += share);
    } else {
      exp.distributions.forEach(d => {
        partnerExpenseMap[d.partnerId] = (partnerExpenseMap[d.partnerId] || 0) + d.amount;
      });
    }
  });
  
  const partnerStats: PartnerFinancials[] = PARTNERS.map(partner => {
    // 1. Revenue
    const revenue = state.payments.reduce((sum, p) => {
      const dist = p.distributions.find(d => d.partnerId === partner.id);
      return sum + (dist ? dist.amount : 0);
    }, 0);

    // 2. Expense Share
    const expenseShare = partnerExpenseMap[partner.id] || 0;

    // 3. Taxable Base (Revenue - Share of expenses)
    const taxableBase = revenue - expenseShare;
    
    // 4. Corp Tax Share (Only if positive)
    const corporateTaxShare = taxableBase > 0 ? taxableBase * TAX_RATE : 0;

    // 5. Net Profit Share (Available for dividend)
    const netProfitShare = taxableBase - corporateTaxShare;

    // 6. Dividends Taken
    const dividendsTaken = state.dividends
      .filter(d => d.partnerId === partner.id)
      .reduce((sum, d) => sum + d.grossAmount, 0);

    const dividendTaxPaid = state.dividends
      .filter(d => d.partnerId === partner.id)
      .reduce((sum, d) => sum + d.taxAmount, 0);

    // 7. Balance
    const balance = netProfitShare - dividendsTaken;

    return {
      partnerId: partner.id,
      name: partner.name,
      revenue,
      expenseShare,
      taxableBase,
      corporateTaxShare,
      netProfitShare,
      dividendsTakenGross: dividendsTaken,
      dividendTaxPaid,
      balance
    };
  });

  return {
    summary: {
      totalRevenue,
      totalExpenses,
      taxableProfit,
      corporateTax,
      netProfit 
    },
    partnerStats
  };
};

// --- Helper Components ---

interface SectionTitleProps {
  children: React.ReactNode;
  icon?: any;
  color?: string;
}

const SectionTitle: React.FC<SectionTitleProps> = ({ children, icon: Icon, color }) => (
  <h2 className={`text-xl font-bold mb-4 flex items-center gap-2 ${color || 'text-slate-700'}`}>
    {Icon && <Icon className="w-6 h-6" />}
    {children}
  </h2>
);

// --- Main Component ---

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'projects' | 'income' | 'expenses' | 'dividends' | 'reports' | 'settings'>('dashboard');
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  
  // -- Load/Save --
  useEffect(() => {
    const saved = localStorage.getItem('dimov_finance_app_v2');
    if (saved) {
      try {
        setState(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load state", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('dimov_finance_app_v2', JSON.stringify(state));
  }, [state]);

  // -- Derived State --
  const financials = useMemo(() => calculateFinancials(state), [state]);

  // -- Handlers --
  const addProject = (name: string, desc: string, type: 'construction' | 'electrical') => {
    if (!name) return;
    const newProject: Project = {
      id: Date.now().toString(),
      name,
      description: desc,
      type,
      status: 'active',
      createdAt: new Date().toISOString()
    };
    setState(prev => ({ ...prev, projects: [...prev.projects, newProject] }));
  };

  const addExpense = (desc: string, amount: number, date: string, category: string, distributions: {partnerId: string, amount: number}[]) => {
    const newExpense: Expense = {
      id: Date.now().toString(),
      description: desc,
      amount,
      date,
      category,
      distributions
    };
    setState(prev => ({ ...prev, expenses: [...prev.expenses, newExpense] }));
  };

  const addPayment = (projectId: string, total: number, date: string, desc: string, dists: {partnerId: string, amount: number}[]) => {
    const newPayment: Payment = {
      id: Date.now().toString(),
      projectId,
      totalAmount: total,
      date,
      description: desc,
      distributions: dists
    };
    setState(prev => ({ ...prev, payments: [...prev.payments, newPayment] }));
  };

  const addDividend = (partnerId: string, grossAmount: number, date: string) => {
    const tax = grossAmount * DIVIDEND_TAX_RATE;
    const net = grossAmount - tax;
    const newDiv: DividendPayout = {
      id: Date.now().toString(),
      partnerId,
      grossAmount,
      taxAmount: tax,
      netReceived: net,
      date
    };
    setState(prev => ({ ...prev, dividends: [...prev.dividends, newDiv] }));
  };

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "dimov_finance_backup.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        setState(json);
        alert("Данните са заредени успешно!");
      } catch (err) {
        alert("Грешка при четене на файла.");
      }
    };
    reader.readAsText(file);
  };

  // --- Sub-Components ---

  const DashboardView = () => (
    <div className="space-y-6">
      <SectionTitle icon={LayoutDashboard} color="text-indigo-600">Финансово Табло</SectionTitle>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <FinancialCard 
          title="Общи Приходи" 
          amount={financials.summary.totalRevenue} 
          icon={TrendingUp} 
          colorClass="text-emerald-600 bg-emerald-600" 
        />
        <FinancialCard 
          title="Общи Разходи" 
          amount={financials.summary.totalExpenses} 
          icon={Receipt} 
          colorClass="text-red-500 bg-red-500" 
        />
        <FinancialCard 
          title="Корпоративен Данък (10%)" 
          amount={financials.summary.corporateTax} 
          icon={FileText} 
          colorClass="text-amber-500 bg-amber-500" 
        />
        <FinancialCard 
          title="Нетна Печалба" 
          amount={financials.summary.netProfit} 
          icon={Wallet} 
          colorClass="text-blue-600 bg-blue-600" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow border border-slate-100">
          <h3 className="text-lg font-bold text-slate-600 mb-4">Приходи по Екип</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={financials.partnerStats}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{fontSize: 12}} interval={0} tickFormatter={(val) => val.split(' ')[0]} />
                <YAxis />
                <Tooltip 
                  formatter={(value: number) => value.toLocaleString('bg-BG', { style: 'currency', currency: 'BGN' })}
                  contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                />
                <Bar dataKey="revenue" name="Приходи" radius={[6, 6, 0, 0]}>
                  {financials.partnerStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 2 ? '#EAB308' : '#3B82F6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow border border-slate-100">
          <h3 className="text-lg font-bold text-slate-600 mb-4">Текущ Баланс (За взимане)</h3>
          <div className="h-64">
             <ResponsiveContainer width="100%" height="100%">
              <BarChart data={financials.partnerStats} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={true} />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12}} tickFormatter={(val) => val.split(' ')[0]} />
                <Tooltip formatter={(value: number) => value.toLocaleString('bg-BG', { style: 'currency', currency: 'BGN' })} />
                <Bar dataKey="balance" name="Баланс" fill="#10B981" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );

  const ProjectsView = () => {
    const [name, setName] = useState('');
    const [desc, setDesc] = useState('');
    const [type, setType] = useState<'construction' | 'electrical'>('construction');
    
    return (
      <div className="space-y-6">
        <SectionTitle icon={Briefcase} color="text-blue-600">Управление на Проекти</SectionTitle>

        <div className="bg-white p-6 rounded-xl shadow-md border-t-4 border-blue-500">
          <h3 className="text-lg font-bold mb-4 text-slate-700">Нов Проект</h3>
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
              <label className="block text-sm font-medium text-slate-500 mb-2">Име на проект</label>
              <input 
                value={name} 
                onChange={e => setName(e.target.value)} 
                className="w-full rounded-lg border-blue-200 border bg-white p-3 text-base text-slate-700 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all placeholder:text-slate-300" 
                placeholder="Напр. Жилищна сграда Младост" 
              />
            </div>
            <div className="w-full md:w-48">
              <label className="block text-sm font-medium text-slate-500 mb-2">Тип</label>
              <select 
                value={type} 
                onChange={(e) => setType(e.target.value as any)}
                className="w-full rounded-lg border-blue-200 border bg-white p-3 text-base text-slate-700 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all"
              >
                <option value="construction">Конструкции</option>
                <option value="electrical">Електро</option>
              </select>
            </div>
            <div className="flex-1 w-full">
              <label className="block text-sm font-medium text-slate-500 mb-2">Описание (опция)</label>
              <input 
                value={desc} 
                onChange={e => setDesc(e.target.value)} 
                className="w-full rounded-lg border-blue-200 border bg-white p-3 text-base text-slate-700 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all placeholder:text-slate-300" 
                placeholder="Допълнителна информация..." 
              />
            </div>
            <button 
              onClick={() => { addProject(name, desc, type); setName(''); setDesc(''); setType('construction'); }}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg text-base font-bold hover:bg-blue-700 shadow transition-colors w-full md:w-auto"
            >
              Добави
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow overflow-hidden border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-500 uppercase tracking-wider">Проект</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-500 uppercase tracking-wider">Тип</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-500 uppercase tracking-wider">Статус</th>
                <th className="px-6 py-4 text-right text-sm font-bold text-slate-500 uppercase tracking-wider">Действия</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {state.projects.map(p => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-700 text-lg">{p.name}</div>
                    <div className="text-sm text-slate-400">{p.description}</div>
                  </td>
                  <td className="px-6 py-4">
                    {p.type === 'electrical' ? (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                        <Zap className="w-4 h-4 mr-1" /> Електро
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                        <HardHat className="w-4 h-4 mr-1" /> Конструкции
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 text-sm font-medium rounded-full bg-green-100 text-green-800 border border-green-200">
                      Активен
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-full transition-colors" title="Изтрий" onClick={() => {
                       if(window.confirm('Сигурни ли сте, че искате да изтриете този проект?')) setState(prev => ({...prev, projects: prev.projects.filter(pr => pr.id !== p.id)}));
                    }}>
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
              {state.projects.length === 0 && (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-400 text-base">Няма добавени проекти</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const IncomeView = () => {
    const [projectId, setProjectId] = useState('');
    const [amount, setAmount] = useState<string>('');
    const [desc, setDesc] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [splits, setSplits] = useState<{[key: string]: string}>({});

    // Ensure we select the first project by default if none selected but available
    useEffect(() => {
      if (!projectId && state.projects.length > 0) {
        setProjectId(state.projects[0].id);
      }
    }, [state.projects, projectId]);

    const currentDistributed = Object.values(splits).reduce<number>((a, b) => a + (parseFloat(b) || 0), 0);
    const total = parseFloat(amount) || 0;
    const remaining = total - currentDistributed;
    // Allow small epsilon error for float math
    const isBalanced = Math.abs(remaining) < 0.1;

    const handleSave = () => {
      const distributions = Object.entries(splits).map(([pid, amt]) => ({
        partnerId: pid,
        amount: parseFloat(amt as string) || 0
      })).filter(d => d.amount > 0);

      if (!isBalanced) {
        if (!window.confirm(`Сумата не е разпределена напълно (Остатък: ${remaining.toFixed(2)} лв). Продължаване?`)) return;
      }

      addPayment(projectId, total, date, desc, distributions);
      setAmount('');
      setDesc('');
      setSplits({});
    };

    const autoFill = (pid: string) => {
       const currentVal = parseFloat(splits[pid] || '0');
       const newVal = (currentVal + remaining).toFixed(2);
       setSplits(prev => ({
         ...prev,
         [pid]: newVal
       }));
    };

    const activeProject = state.projects.find(p => p.id === projectId);

    return (
      <div className="space-y-6">
        <SectionTitle icon={Wallet} color="text-emerald-600">Въвеждане на Приход</SectionTitle>

        <div className="bg-white p-6 rounded-xl shadow-md border-t-4 border-emerald-500">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
             <div className="col-span-1 md:col-span-2">
               <label className="block text-sm font-medium text-slate-500 mb-2">Проект</label>
               <select 
                value={projectId} 
                onChange={e => setProjectId(e.target.value)} 
                className="w-full rounded-lg border-emerald-200 border bg-white p-3 text-base text-slate-700 focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 outline-none transition-all"
               >
                 <option value="">Избери проект...</option>
                 {state.projects.map(p => (
                   <option key={p.id} value={p.id}>
                     {p.name} {p.type === 'electrical' ? '(Ел)' : '(Констр.)'}
                   </option>
                 ))}
               </select>
               {activeProject && (
                 <div className={`mt-2 text-sm px-3 py-1 inline-block rounded-full ${activeProject.type === 'electrical' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}`}>
                   {activeProject.type === 'electrical' ? 'Електро Проект' : 'Конструктивен Проект'}
                 </div>
               )}
             </div>
             <div>
               <label className="block text-sm font-medium text-slate-500 mb-2">Сума (лв.)</label>
               <div className="relative">
                 <span className="absolute left-3 top-3 text-slate-400 font-bold">BGN</span>
                 <input 
                  type="number" 
                  value={amount} 
                  onChange={e => setAmount(e.target.value)} 
                  className="w-full rounded-lg border-emerald-200 border bg-white p-3 pl-12 text-lg font-bold text-slate-700 focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 outline-none transition-all placeholder:text-slate-300"
                  placeholder="0.00" 
                 />
               </div>
             </div>
             <div>
                <label className="block text-sm font-medium text-slate-500 mb-2">Дата</label>
                <input 
                  type="date" 
                  value={date} 
                  onChange={e => setDate(e.target.value)} 
                  className="w-full rounded-lg border-emerald-200 border bg-white p-3 text-base text-slate-700 focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 outline-none transition-all"
                />
             </div>
             <div className="col-span-1 md:col-span-2">
               <label className="block text-sm font-medium text-slate-500 mb-2">Описание</label>
               <input 
                 type="text" 
                 value={desc} 
                 onChange={e => setDesc(e.target.value)} 
                 className="w-full rounded-lg border-emerald-200 border bg-white p-3 text-base text-slate-700 focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 outline-none transition-all placeholder:text-slate-300"
                 placeholder="Авансово плащане..." 
               />
             </div>
           </div>

           <div className="bg-emerald-50 p-6 rounded-xl border border-emerald-100">
             <div className="flex justify-between items-center mb-4">
               <span className="text-base font-bold text-emerald-900 flex items-center gap-2">
                 <PieChart className="w-5 h-5" /> Разпределение на сумата
               </span>
               <span className={`text-sm font-bold px-3 py-1 rounded ${isBalanced ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                 За разпределяне: {remaining.toFixed(2)} лв.
               </span>
             </div>
             
             <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
               {PARTNERS.map(partner => (
                 <div key={partner.id} className="bg-white p-3 rounded-lg shadow-sm border border-emerald-100">
                   <label 
                     onClick={() => autoFill(partner.id)} 
                     className="block text-sm font-bold text-slate-600 mb-2 cursor-pointer hover:text-emerald-600 flex justify-between"
                     title="Кликни за автоматично попълване на остатъка"
                   >
                     {partner.name.split(' ')[0]}
                     <span className="text-xs font-normal text-slate-400 bg-slate-50 px-2 rounded-full">Кликни</span>
                   </label>
                   <input 
                    type="number" 
                    value={splits[partner.id] || ''} 
                    onChange={e => setSplits(prev => ({...prev, [partner.id]: e.target.value}))}
                    className="w-full rounded border-slate-200 border p-2 text-lg font-bold text-center text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none bg-white placeholder:text-slate-200" 
                    placeholder="0"
                   />
                 </div>
               ))}
             </div>
             
             <button 
              onClick={handleSave}
              disabled={!projectId || total <= 0}
              className={`mt-6 w-full py-3 rounded-lg text-base font-bold shadow-md transition-all
                ${!projectId || total <= 0 
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed' 
                  : 'bg-emerald-600 text-white hover:bg-emerald-700 transform hover:-translate-y-0.5'}`}
             >
               ЗАПИШИ ПРИХОД
             </button>
           </div>
        </div>

        {/* Payments List */}
        <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
           <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
             <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Последни плащания</h3>
           </div>
           <ul className="divide-y divide-slate-100">
             {state.payments.slice().reverse().map(payment => {
               const proj = state.projects.find(p => p.id === payment.projectId);
               return (
                 <li key={payment.id} className="px-6 py-4 flex flex-col sm:flex-row justify-between sm:items-center hover:bg-slate-50 transition-colors">
                   <div className="mb-2 sm:mb-0">
                     <p className="font-bold text-lg text-slate-700 flex items-center gap-2">
                        {proj?.name || 'Неизвестен проект'}
                        <span className="text-xs font-normal text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">{payment.date}</span>
                     </p>
                     <p className="text-sm text-slate-400">{payment.description}</p>
                   </div>
                   <div className="text-left sm:text-right">
                     <p className="text-emerald-600 font-bold text-xl">+{payment.totalAmount.toLocaleString('bg-BG', {style:'currency', currency:'BGN'})}</p>
                     <div className="flex gap-2 mt-1 sm:justify-end">
                        {payment.distributions.map(d => {
                             const pName = PARTNERS.find(p => p.id === d.partnerId)?.name.split(' ')[0];
                             return (
                               <span key={d.partnerId} className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded border border-emerald-100">
                                 {pName}: {d.amount.toFixed(0)}
                               </span>
                             )
                        })}
                     </div>
                   </div>
                 </li>
               )
             })}
           </ul>
        </div>
      </div>
    );
  };

  const ExpensesView = () => {
    const [desc, setDesc] = useState('');
    const [amount, setAmount] = useState('');
    const [cat, setCat] = useState(EXPENSE_CATEGORIES[0]);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    
    // Distribution State
    const [distType, setDistType] = useState<'ps_split' | 'common' | 'individual' | 'manual'>('ps_split');
    const [selectedPartner, setSelectedPartner] = useState(PARTNERS[0].id);
    const [splits, setSplits] = useState<{[key: string]: string}>({});

    const handleAdd = () => {
      if(!amount || !desc) {
        alert("Моля въведете сума и описание.");
        return;
      }
      
      const numAmount = parseFloat(amount);
      let distributions: {partnerId: string, amount: number}[] = [];

      if (distType === 'common') {
        const share = numAmount / PARTNERS.length;
        distributions = PARTNERS.map(p => ({ partnerId: p.id, amount: share }));
      } else if (distType === 'ps_split') {
        const p1 = PARTNERS.find(p => p.name.includes('Пламен'))?.id || PARTNERS[0].id;
        const p2 = PARTNERS.find(p => p.name.includes('Светлозар'))?.id || PARTNERS[1].id;
        distributions = [
          { partnerId: p1, amount: numAmount / 2 },
          { partnerId: p2, amount: numAmount / 2 }
        ];
      } else if (distType === 'individual') {
        distributions = [{ partnerId: selectedPartner, amount: numAmount }];
      } else {
        distributions = Object.entries(splits).map(([pid, amt]) => ({
          partnerId: pid,
          amount: parseFloat(amt as string) || 0
        })).filter(d => d.amount > 0);
      }

      addExpense(desc, numAmount, date, cat, distributions);
      setDesc('');
      setAmount('');
      setSplits({});
    };

    return (
      <div className="space-y-6">
        <SectionTitle icon={Receipt} color="text-red-600">Въвеждане на Разход</SectionTitle>
        
        <div className="bg-white p-6 rounded-xl shadow-md border-t-4 border-red-500">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="col-span-1 md:col-span-2">
                <label className="block text-sm font-medium text-slate-500 mb-2">Описание на разхода</label>
                <input 
                  value={desc} 
                  onChange={e => setDesc(e.target.value)} 
                  className="w-full rounded-lg border-red-200 border bg-white p-3 text-base text-slate-700 focus:ring-2 focus:ring-red-100 focus:border-red-400 outline-none transition-all placeholder:text-slate-300"
                  placeholder="Наем офис..." 
                />
             </div>
             <div>
                <label className="block text-sm font-medium text-slate-500 mb-2">Сума (лв.)</label>
                <input 
                  type="number" 
                  value={amount} 
                  onChange={e => setAmount(e.target.value)} 
                  className="w-full rounded-lg border-red-200 border bg-white p-3 text-lg font-bold text-slate-700 focus:ring-2 focus:ring-red-100 focus:border-red-400 outline-none transition-all placeholder:text-slate-300"
                  placeholder="0.00" 
                />
             </div>
             <div>
                <label className="block text-sm font-medium text-slate-500 mb-2">Дата</label>
                <input 
                  type="date" 
                  value={date} 
                  onChange={e => setDate(e.target.value)} 
                  className="w-full rounded-lg border-red-200 border bg-white p-3 text-base text-slate-700 focus:ring-2 focus:ring-red-100 focus:border-red-400 outline-none transition-all"
                />
             </div>
             
             <div className="col-span-1 md:col-span-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <label className="block text-sm font-bold text-slate-600 mb-3">Кой поема разхода?</label>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <button onClick={() => setDistType('ps_split')} className={`p-3 rounded-lg text-sm font-bold border transition-all ${distType === 'ps_split' ? 'bg-blue-600 text-white border-blue-700 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}>
                    Пламен + Светльо (50/50)
                  </button>
                  <button onClick={() => setDistType('common')} className={`p-3 rounded-lg text-sm font-bold border transition-all ${distType === 'common' ? 'bg-blue-600 text-white border-blue-700 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}>
                    Общ (Всички 3-ма)
                  </button>
                  <button onClick={() => setDistType('individual')} className={`p-3 rounded-lg text-sm font-bold border transition-all ${distType === 'individual' ? 'bg-blue-600 text-white border-blue-700 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}>
                    Индивидуален
                  </button>
                  <button onClick={() => setDistType('manual')} className={`p-3 rounded-lg text-sm font-bold border transition-all ${distType === 'manual' ? 'bg-blue-600 text-white border-blue-700 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}>
                    Ръчно (%)
                  </button>
                </div>
                
                {distType === 'individual' && (
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 animate-in fade-in slide-in-from-top-2">
                    <label className="text-xs font-bold text-blue-800 uppercase mb-1 block">Избери човек</label>
                    <select value={selectedPartner} onChange={e => setSelectedPartner(e.target.value)} className="w-full text-base border-slate-300 p-2 rounded shadow-sm">
                      {PARTNERS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                )}

                {distType === 'manual' && (
                   <div className="grid grid-cols-3 gap-4 mt-2 animate-in fade-in slide-in-from-top-2">
                     {PARTNERS.map(p => (
                       <div key={p.id}>
                         <label className="text-xs font-bold text-slate-500 block mb-1">{p.name.split(' ')[0]}</label>
                         <input type="number" className="w-full border border-slate-300 rounded p-2 text-sm" placeholder="0" 
                           value={splits[p.id] || ''} 
                           onChange={e => setSplits(prev => ({...prev, [p.id]: e.target.value}))}
                         />
                       </div>
                     ))}
                   </div>
                )}
             </div>
          </div>
          <button 
            onClick={handleAdd}
            className="w-full mt-6 bg-red-600 text-white px-6 py-3 rounded-lg text-base font-bold hover:bg-red-700 shadow-md transition-all transform hover:-translate-y-0.5"
          >
            ДОБАВИ РАЗХОД
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Описание</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase">Сума</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {state.expenses.slice().reverse().map(e => (
                <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-700 text-base">{e.description}</div>
                    <div className="flex gap-2 mt-1">
                      <span className="text-xs text-slate-500 border border-slate-200 rounded px-2 py-0.5 bg-slate-50">{new Date(e.date).toLocaleDateString('bg-BG')}</span>
                      <span className="text-xs text-slate-500 border border-slate-200 rounded px-2 py-0.5 bg-slate-50">{e.category}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="text-red-500 font-bold text-lg">-{e.amount.toFixed(2)} лв.</div>
                    <div className="text-xs text-slate-400 mt-1">
                       {!e.distributions || e.distributions.length === 0 
                         ? 'Разделено на всички' 
                         : e.distributions.length === 2 && e.distributions.every(d => d.amount === e.distributions[0].amount) && e.distributions.some(d => d.partnerId === PARTNERS[0].id) && e.distributions.some(d => d.partnerId === PARTNERS[1].id)
                            ? 'Пламен + Светльо'
                            : e.distributions.length === 1
                               ? PARTNERS.find(p => p.id === e.distributions[0].partnerId)?.name.split(' ')[0]
                               : 'Ръчно делене'}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const DividendsView = () => {
    const [partnerId, setPartnerId] = useState(PARTNERS[0].id);
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    const selectedStats = financials.partnerStats.find(p => p.partnerId === partnerId);
    const maxBalance = selectedStats ? selectedStats.balance : 0;

    return (
      <div className="space-y-6">
        <SectionTitle icon={Users} color="text-purple-600">Управление на Дивиденти</SectionTitle>

        <div className="bg-white p-6 rounded-xl shadow-md border-t-4 border-purple-500">
          <h3 className="text-lg font-bold mb-4 text-slate-700">Регистриране на изплащане</h3>
          <div className="space-y-4 max-w-2xl">
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-2">Получател</label>
              <select value={partnerId} onChange={e => setPartnerId(e.target.value)} className="w-full rounded-lg border border-purple-200 bg-white p-3 text-base text-slate-700 focus:ring-2 focus:ring-purple-100 focus:border-purple-400 outline-none transition-all">
                {PARTNERS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <div className="mt-2 p-3 bg-slate-50 rounded border border-slate-200 flex justify-between items-center">
                 <span className="text-sm text-slate-600">Наличен за теглене:</span>
                 <span className="font-bold text-xl text-emerald-600">{maxBalance.toLocaleString('bg-BG', {style:'currency', currency:'BGN'})}</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-2">Брутна Сума за теглене</label>
              <input 
                type="number" 
                value={amount} 
                onChange={e => setAmount(e.target.value)} 
                className="w-full rounded-lg border border-purple-200 bg-white p-3 text-lg font-bold text-slate-700 focus:ring-2 focus:ring-purple-100 focus:border-purple-400 outline-none transition-all placeholder:text-slate-300"
                placeholder="0.00" 
              />
              {amount && parseFloat(amount) > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-4">
                   <div className="bg-amber-50 p-3 rounded border border-amber-100 text-center">
                     <div className="text-xs text-amber-800 font-bold uppercase">Данък (5%)</div>
                     <div className="text-lg font-bold text-amber-700">{(parseFloat(amount) * 0.05).toFixed(2)} лв.</div>
                   </div>
                   <div className="bg-green-50 p-3 rounded border border-green-100 text-center">
                     <div className="text-xs text-green-800 font-bold uppercase">Чиста сума</div>
                     <div className="text-lg font-bold text-green-700">{(parseFloat(amount) * 0.95).toFixed(2)} лв.</div>
                   </div>
                </div>
              )}
            </div>
            <button 
              disabled={!amount || parseFloat(amount) <= 0}
              onClick={() => {
                 addDividend(partnerId, parseFloat(amount), date);
                 setAmount('');
              }}
              className="w-full bg-purple-600 text-white py-3 rounded-lg text-base font-bold hover:bg-purple-700 shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Запиши Изплащане
            </button>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-md border border-slate-200">
          <h3 className="text-lg font-bold mb-4 text-slate-700">История на плащанията</h3>
          <ul className="divide-y divide-slate-100">
            {state.dividends.slice().reverse().map(div => {
              const pName = PARTNERS.find(p => p.id === div.partnerId)?.name;
              return (
                <li key={div.id} className="py-3 flex justify-between items-center hover:bg-slate-50 transition-colors px-2 rounded">
                  <div>
                    <span className="font-bold text-slate-700 block text-base">{pName?.split(' ')[0]}</span>
                    <span className="text-slate-400 text-sm block">{new Date(div.date).toLocaleDateString('bg-BG')}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-emerald-600 text-lg">{div.netReceived.toFixed(0)} лв. <span className="text-xs text-slate-400 font-normal">(нет)</span></div>
                    <div className="text-xs text-slate-400">Данък: {div.taxAmount.toFixed(0)} лв.</div>
                  </div>
                </li>
              )
            })}
            {state.dividends.length === 0 && <li className="text-slate-400 py-4 text-center">Няма история</li>}
          </ul>
        </div>
      </div>
    );
  };

  const ReportsView = () => {
    const [aiReport, setAiReport] = useState('');
    const [loading, setLoading] = useState(false);
    const [prompt, setPrompt] = useState('');

    const handleGenerateReport = async () => {
      setLoading(true);
      const text = await generateReport(state, financials.summary, financials.partnerStats, prompt);
      setAiReport(text);
      setLoading(false);
    };

    return (
      <div className="space-y-6">
        <SectionTitle icon={FileText} color="text-indigo-600">Отчети и Анализи</SectionTitle>

        {/* Detailed Table */}
        <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-x-auto">
          <table className="min-w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Име</th>
                <th className="px-4 py-3 text-right">Приход</th>
                <th className="px-4 py-3 text-right">Разходен Дял</th>
                <th className="px-4 py-3 text-right">Корп. Данък</th>
                <th className="px-4 py-3 text-right bg-blue-50 text-blue-900 border-x border-blue-100">Нетна Печалба</th>
                <th className="px-4 py-3 text-right">Изтеглени</th>
                <th className="px-4 py-3 text-right font-bold bg-green-50 text-green-900 border-l border-green-100">БАЛАНС</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {financials.partnerStats.map(p => (
                <tr key={p.partnerId} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-bold text-slate-700">{p.name.split(' ')[0]}</td>
                  <td className="px-4 py-3 text-right text-emerald-600 font-medium">{p.revenue.toLocaleString('bg-BG')}</td>
                  <td className="px-4 py-3 text-right text-red-500 font-medium">{p.expenseShare.toLocaleString('bg-BG')}</td>
                  <td className="px-4 py-3 text-right text-amber-600 font-medium">{p.corporateTaxShare.toLocaleString('bg-BG')}</td>
                  <td className="px-4 py-3 text-right font-bold bg-blue-50 text-blue-800 border-x border-blue-100">{p.netProfitShare.toLocaleString('bg-BG')}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{p.dividendsTakenGross.toLocaleString('bg-BG')}</td>
                  <td className="px-4 py-3 text-right font-black bg-green-50 text-emerald-800 text-base border-l border-green-100">{p.balance.toLocaleString('bg-BG')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* AI Report Section */}
        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-4">
             <h3 className="text-lg font-bold flex items-center gap-2 text-slate-700">
               <span className="p-2 bg-indigo-100 text-indigo-700 rounded-lg"><Zap className="w-5 h-5" /></span>
               AI Финансов Асистент
             </h3>
             {state.payments.length > 0 && !loading && (
               <button onClick={handleGenerateReport} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 shadow transition-colors">
                 {aiReport ? "Обнови анализа" : "Генерирай анализ"}
               </button>
             )}
          </div>
          
          <div className="mb-4">
             <input 
              className="w-full border border-slate-300 rounded-lg p-3 text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
              placeholder="Задай специфичен въпрос (напр. 'Как да оптимизираме разходите?')..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>

          {loading ? (
             <div className="p-8 text-center bg-slate-50 rounded-lg border border-slate-100">
                <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-3"></div>
                <p className="text-slate-500 font-medium">Генериране на отчет...</p>
             </div>
          ) : aiReport ? (
             <div className="prose prose-slate max-w-none bg-slate-50 p-6 rounded-xl border border-slate-200 shadow-inner">
               <div dangerouslySetInnerHTML={{ __html: aiReport.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br />') }} />
             </div>
          ) : (
            <div className="text-center p-8 bg-slate-50 rounded-lg border border-dashed border-slate-300 text-slate-400">
              Натисни бутона за да генерираш автоматичен анализ на фирмените финанси.
            </div>
          )}
        </div>
      </div>
    );
  };

  const SettingsView = () => (
    <div className="max-w-2xl mx-auto space-y-6">
      <SectionTitle icon={Settings}>Настройки на данни</SectionTitle>
      
      <div className="bg-white p-8 rounded-xl shadow-md border border-slate-200">
        <h3 className="text-lg font-bold mb-4 text-slate-700">Резервно копие</h3>
        <p className="text-slate-500 text-sm mb-6">Свалете текущото състояние на базата данни или заредете файл от друго устройство.</p>
        
        <div className="flex flex-col sm:flex-row gap-4">
          <button 
            onClick={handleExport}
            className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-3 rounded-lg text-base font-bold hover:bg-blue-700 shadow-lg transition-all transform hover:-translate-y-0.5"
          >
            <Download className="w-5 h-5" /> Експорт (Свали)
          </button>
          <label className="flex-1 flex items-center justify-center gap-2 bg-white border-2 border-slate-200 text-slate-700 px-4 py-3 rounded-lg text-base font-bold hover:bg-slate-50 hover:border-slate-300 cursor-pointer shadow-sm transition-all">
            <Upload className="w-5 h-5" /> Импорт (Качи)
            <input type="file" accept=".json" onChange={handleImport} className="hidden" />
          </label>
        </div>
      </div>

      <div className="bg-red-50 p-8 rounded-xl shadow-md border border-red-100">
        <h3 className="text-lg font-bold text-red-800 mb-2">Опасна зона</h3>
        <p className="text-red-600 text-sm mb-4">Това действие ще изтрие всички въведени данни и не може да бъде отменено.</p>
        <button 
          onClick={() => { if(window.confirm("Сигурни ли сте? Всички данни ще бъдат изтрити завинаги!")) setState(INITIAL_STATE); }}
          className="flex items-center text-red-600 bg-white border border-red-200 hover:bg-red-50 hover:border-red-300 px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-colors"
        >
          <Trash2 className="w-4 h-4 mr-2" /> Нулиране на данни
        </button>
      </div>
    </div>
  );

  const NavItem = ({ id, icon: Icon, label }: { id: typeof activeTab, icon: any, label: string }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
        activeTab === id 
          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg transform scale-105' 
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      <Icon className={`w-5 h-5 ${activeTab === id ? 'text-white' : 'text-slate-500'}`} />
      <span className="text-sm font-bold">{label}</span>
    </button>
  );

  return (
    <div className="h-screen flex flex-col md:flex-row bg-slate-50 font-sans">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-white border-r border-slate-200 flex flex-col z-20 shadow-xl">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3">
           <div className="bg-blue-600 p-2 rounded-lg text-white shadow-lg shadow-blue-200"><Briefcase className="w-6 h-6" /></div>
           <div>
             <h1 className="font-black text-slate-800 text-lg tracking-tight">DIMOV</h1>
             <p className="text-xs font-bold text-slate-400 tracking-widest uppercase">Finance App</p>
           </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-4 mt-2">Меню</div>
          <NavItem id="dashboard" icon={LayoutDashboard} label="Табло" />
          <NavItem id="projects" icon={Briefcase} label="Проекти" />
          <NavItem id="income" icon={Wallet} label="Приходи" />
          <NavItem id="expenses" icon={Receipt} label="Разходи" />
          <NavItem id="dividends" icon={Users} label="Дивиденти" />
          
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-4 mt-6">Анализ</div>
          <NavItem id="reports" icon={FileText} label="Отчети" />
          
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-4 mt-6">Система</div>
          <NavItem id="settings" icon={Settings} label="Настройки" />
        </nav>

        <div className="p-4 border-t border-slate-100 bg-slate-50">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold">Д</div>
            <div className="text-xs">
              <div className="font-bold text-slate-700">Димов ООД</div>
              <div className="text-slate-400">Версия 2.0</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-slate-50">
        <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex justify-between items-center md:hidden">
           <div className="font-bold text-slate-800">Димов Финанси</div>
           {/* Mobile menu could go here */}
        </header>

        <div className="p-4 md:p-8 max-w-7xl mx-auto pb-24 md:pb-8">
          {activeTab === 'dashboard' && <DashboardView />}
          {activeTab === 'projects' && <ProjectsView />}
          {activeTab === 'income' && <IncomeView />}
          {activeTab === 'expenses' && <ExpensesView />}
          {activeTab === 'dividends' && <DividendsView />}
          {activeTab === 'reports' && <ReportsView />}
          {activeTab === 'settings' && <SettingsView />}
        </div>
      </main>
    </div>
  );
}