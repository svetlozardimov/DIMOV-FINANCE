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
  PieChart as PieChartIcon,
  AlertTriangle,
  Plus,
  Save,
  Search,
  ArrowUpDown,
  Percent,
  Euro,
  Calendar,
  Printer
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  Legend,
  PieChart,
  Pie,
  AreaChart,
  Area
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

// --- Constants & Utils ---

const EXCHANGE_RATE_EUR = 1.95583;

const toEuroStr = (bgnAmount: number) => {
  return (bgnAmount / EXCHANGE_RATE_EUR).toLocaleString('bg-BG', { style: 'currency', currency: 'EUR' });
};

const calculateFinancials = (state: AppState): { 
  summary: FinancialSummary, 
  partnerStats: PartnerFinancials[],
  monthlyData: any[] 
} => {
  const totalRevenue = state.payments.reduce<number>((sum, p) => sum + p.totalAmount, 0);
  const totalExpenses = state.expenses.reduce<number>((sum, e) => sum + e.amount, 0);
  
  const taxableProfit = Math.max(0, totalRevenue - totalExpenses);
  const corporateTax = taxableProfit * TAX_RATE;
  const netProfit = totalRevenue - totalExpenses - corporateTax;

  // Calculate expense share per partner
  const partnerExpenseMap: Record<string, number> = {};
  PARTNERS.forEach(p => partnerExpenseMap[p.id] = 0);

  state.expenses.forEach(exp => {
    if (!exp.distributions || exp.distributions.length === 0) {
      const share = exp.amount / PARTNERS.length;
      PARTNERS.forEach(p => partnerExpenseMap[p.id] += share);
    } else {
      exp.distributions.forEach(d => {
        partnerExpenseMap[d.partnerId] = (partnerExpenseMap[d.partnerId] || 0) + d.amount;
      });
    }
  });
  
  const partnerStats: PartnerFinancials[] = PARTNERS.map(partner => {
    const revenue = state.payments.reduce((sum, p) => {
      const dist = p.distributions.find(d => d.partnerId === partner.id);
      return sum + (dist ? dist.amount : 0);
    }, 0);

    const expenseShare = partnerExpenseMap[partner.id] || 0;
    const taxableBase = revenue - expenseShare;
    const corporateTaxShare = taxableBase > 0 ? taxableBase * TAX_RATE : 0;
    const netProfitShare = taxableBase - corporateTaxShare;

    const dividendsTaken = state.dividends
      .filter(d => d.partnerId === partner.id)
      .reduce((sum, d) => sum + d.grossAmount, 0);

    const dividendTaxPaid = state.dividends
      .filter(d => d.partnerId === partner.id)
      .reduce((sum, d) => sum + d.taxAmount, 0);

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

  // Monthly Aggregation
  const monthlyMap: Record<string, {name: string, income: number, expense: number}> = {};
  
  state.payments.forEach(p => {
    const month = p.date.substring(0, 7); // YYYY-MM
    if (!monthlyMap[month]) monthlyMap[month] = { name: month, income: 0, expense: 0 };
    monthlyMap[month].income += p.totalAmount;
  });

  state.expenses.forEach(e => {
    const month = e.date.substring(0, 7);
    if (!monthlyMap[month]) monthlyMap[month] = { name: month, income: 0, expense: 0 };
    monthlyMap[month].expense += e.amount;
  });

  const monthlyData = Object.values(monthlyMap).sort((a, b) => a.name.localeCompare(b.name));

  return {
    summary: {
      totalRevenue,
      totalExpenses,
      taxableProfit,
      corporateTax,
      netProfit 
    },
    partnerStats,
    monthlyData
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

interface CurrencyInputProps {
  amount: string;
  setAmount: (val: string) => void;
  currency: 'BGN' | 'EUR';
  setCurrency: (val: 'BGN' | 'EUR') => void;
  colorTheme?: string;
}

const CurrencyInput: React.FC<CurrencyInputProps> = ({ amount, setAmount, currency, setCurrency, colorTheme = 'emerald' }) => {
  return (
    <div className="relative flex rounded-lg shadow-sm">
      <div className="relative flex-grow focus-within:z-10">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          {currency === 'BGN' ? <span className="text-slate-400 font-bold text-sm">BGN</span> : <Euro className="h-4 w-4 text-slate-400" />}
        </div>
        <input
          type="number"
          name="price"
          id="price"
          className={`focus:ring-${colorTheme}-500 focus:border-${colorTheme}-500 block w-full pl-12 pr-12 sm:text-lg border-${colorTheme}-200 rounded-l-lg p-3 font-bold text-slate-700 outline-none border bg-white`}
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>
      <button
        type="button"
        onClick={() => setCurrency(currency === 'BGN' ? 'EUR' : 'BGN')}
        className={`-ml-px relative inline-flex items-center px-4 py-2 border border-${colorTheme}-200 text-sm font-medium rounded-r-lg text-slate-700 bg-${colorTheme}-50 hover:bg-${colorTheme}-100 focus:outline-none focus:ring-1 focus:ring-${colorTheme}-500 focus:border-${colorTheme}-500 w-24 justify-center transition-colors`}
      >
        {currency === 'BGN' ? 'Лева' : 'Евро'}
        <ArrowUpDown className="ml-2 h-4 w-4 text-slate-400" />
      </button>
    </div>
  );
};

// --- Main Component ---

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'projects' | 'income' | 'expenses' | 'dividends' | 'reports' | 'settings'>('dashboard');
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  
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

  const financials = useMemo(() => calculateFinancials(state), [state]);

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
        const result = e.target?.result;
        if (typeof result === 'string') {
          const json = JSON.parse(result);
          setState(json);
          alert("Данните са заредени успешно!");
        }
      } catch (err) {
        alert("Грешка при четене на файла.");
      }
    };
    reader.readAsText(file);
  };

  // --- Sub-Components ---

  const DashboardView = () => {
    // Vibrant Palette
    const PARTNER_COLORS = ['#6366f1', '#10b981', '#f59e0b']; // Indigo, Emerald, Amber

    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <SectionTitle icon={LayoutDashboard} color="text-indigo-600">Финансово Табло</SectionTitle>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <FinancialCard 
            title="Общи Приходи" 
            amount={financials.summary.totalRevenue} 
            secondaryAmount={toEuroStr(financials.summary.totalRevenue)}
            icon={TrendingUp} 
            colorClass="text-emerald-600 bg-emerald-600" 
          />
          <FinancialCard 
            title="Общи Разходи" 
            amount={financials.summary.totalExpenses} 
            secondaryAmount={toEuroStr(financials.summary.totalExpenses)}
            icon={Receipt} 
            colorClass="text-red-500 bg-red-500" 
          />
          <FinancialCard 
            title="Данък Печалба (10%)" 
            amount={financials.summary.corporateTax} 
            secondaryAmount={toEuroStr(financials.summary.corporateTax)}
            icon={FileText} 
            colorClass="text-amber-500 bg-amber-500" 
          />
          <FinancialCard 
            title="Нетна Печалба" 
            amount={financials.summary.netProfit} 
            secondaryAmount={toEuroStr(financials.summary.netProfit)}
            icon={Wallet} 
            colorClass="text-blue-600 bg-blue-600" 
          />
        </div>

        {/* Improved Monthly Trend Chart - Area Chart */}
        <div className="bg-white p-6 rounded-xl shadow border border-slate-100">
          <h3 className="text-lg font-bold text-slate-600 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-500" /> Месечен Тренд
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={financials.monthlyData}>
                <defs>
                  <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{fontSize: 12, fill: '#64748b'}} />
                <YAxis tick={{fontSize: 12, fill: '#64748b'}} />
                <Tooltip 
                   formatter={(value: number) => value.toLocaleString('bg-BG', { style: 'currency', currency: 'BGN' })}
                   contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                />
                <Legend iconType="circle" />
                <Area type="monotone" dataKey="income" name="Приходи" stroke="#10b981" fillOpacity={1} fill="url(#colorIncome)" strokeWidth={2} />
                <Area type="monotone" dataKey="expense" name="Разходи" stroke="#ef4444" fillOpacity={1} fill="url(#colorExpense)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue by Partner */}
          <div className="bg-white p-6 rounded-xl shadow border border-slate-100">
            <h3 className="text-lg font-bold text-slate-600 mb-4">Приходи по Екип</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={financials.partnerStats}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{fontSize: 12}} interval={0} tickFormatter={(val) => val.split(' ')[0]} />
                  <YAxis tick={{fontSize: 12, fill: '#94a3b8'}} />
                  <Tooltip 
                    formatter={(value: number) => value.toLocaleString('bg-BG', { style: 'currency', currency: 'BGN' })}
                    contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                    cursor={{fill: '#f8fafc'}}
                  />
                  <Bar dataKey="revenue" name="Приходи" radius={[6, 6, 0, 0]}>
                    {financials.partnerStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PARTNER_COLORS[index % PARTNER_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Profit Distribution */}
          <div className="bg-white p-6 rounded-xl shadow border border-slate-100">
            <h3 className="text-lg font-bold text-slate-600 mb-4">Дял от Печалбата</h3>
            <div className="h-64">
               <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={financials.partnerStats}
                    dataKey="netProfitShare"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                  >
                    {financials.partnerStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PARTNER_COLORS[index % PARTNER_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                     formatter={(value: number) => value.toLocaleString('bg-BG', { style: 'currency', currency: 'BGN' })}
                     contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                  />
                  <Legend iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const ProjectsView = () => {
    const [name, setName] = useState('');
    const [desc, setDesc] = useState('');
    const [type, setType] = useState<'construction' | 'electrical'>('construction');
    const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'name'>('newest');

    const filteredProjects = state.projects
      .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => {
        if (sortOrder === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        if (sortOrder === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        if (sortOrder === 'name') return a.name.localeCompare(b.name);
        return 0;
      });
    
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
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
                onChange={(e) => setType(e.target.value as 'construction' | 'electrical')}
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
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col md:flex-row gap-4 justify-between items-center">
             <div className="relative w-full md:w-96">
                <Search className="absolute left-3 top-3.5 text-slate-400 w-5 h-5" />
                <input 
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Търсене на проект..."
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-slate-700"
                />
             </div>
             <div className="flex items-center gap-2 w-full md:w-auto">
               <ArrowUpDown className="text-slate-400 w-5 h-5" />
               <select 
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest' | 'name')}
                  className="w-full md:w-48 p-3 rounded-lg border border-slate-200 bg-white focus:border-blue-400 outline-none text-slate-700"
               >
                 <option value="newest">Най-нови</option>
                 <option value="oldest">Най-стари</option>
                 <option value="name">По име (А-Я)</option>
               </select>
             </div>
          </div>

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
              {filteredProjects.map(p => (
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
                    <button 
                      className="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-full transition-colors" 
                      title="Изтрий" 
                      onClick={() => setProjectToDelete(p.id)}
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredProjects.length === 0 && (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-400 text-base">Няма намерени проекти</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {projectToDelete && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 border-t-4 border-red-500 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center gap-4 mb-4">
                <div className="bg-red-100 p-3 rounded-full text-red-600">
                   <AlertTriangle className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold text-slate-800">Изтриване на проект?</h3>
              </div>
              <p className="text-slate-600 text-lg mb-8 leading-relaxed">
                Сигурни ли сте, че искате да изтриете проект <span className="font-bold text-slate-800">"{state.projects.find(p => p.id === projectToDelete)?.name}"</span>? 
                <br /><br />
                <span className="text-sm text-red-500 font-medium">Това действие е необратимо.</span>
              </p>
              <div className="flex justify-end gap-4">
                <button 
                  onClick={() => setProjectToDelete(null)}
                  className="px-6 py-3 rounded-xl text-slate-600 font-bold bg-slate-100 hover:bg-slate-200 transition-colors text-lg"
                >
                  Отказ
                </button>
                <button 
                  onClick={() => {
                     setState(prev => ({...prev, projects: prev.projects.filter(pr => pr.id !== projectToDelete)}));
                     setProjectToDelete(null);
                  }}
                  className="px-6 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 shadow-lg shadow-red-200 transition-all transform hover:-translate-y-1 text-lg"
                >
                  Да, Изтрий
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const IncomeView = () => {
    const [projectId, setProjectId] = useState('');
    const [amount, setAmount] = useState<string>('');
    const [currency, setCurrency] = useState<'BGN' | 'EUR'>('BGN'); // New Currency State
    const [desc, setDesc] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [splits, setSplits] = useState<{[key: string]: string}>({});

    useEffect(() => {
      if (!projectId && state.projects.length > 0) {
        setProjectId(state.projects[0].id);
      }
    }, [state.projects, projectId]);

    const currentDistributed = Object.values(splits).reduce<number>((a, b) => a + (parseFloat(b) || 0), 0);
    const totalInput = parseFloat(amount) || 0;
    const remaining = totalInput - currentDistributed;
    const isBalanced = Math.abs(remaining) < 0.1;

    const handleSave = () => {
      const totalInputVal = parseFloat(amount) || 0;
      
      // Convert to BGN for storage
      const rate = currency === 'EUR' ? EXCHANGE_RATE_EUR : 1;
      const totalInBgn = totalInputVal * rate;

      const distributions = Object.entries(splits).map(([pid, amtStr]) => {
        const val = parseFloat(String(amtStr)) || 0;
        return {
          partnerId: pid,
          amount: val * rate // Convert split share to BGN too
        };
      }).filter(d => d.amount > 0);

      if (!isBalanced) {
        if (!window.confirm(`Сумата не е разпределена напълно. Продължаване?`)) return;
      }

      addPayment(projectId, totalInBgn, date, desc, distributions);
      setAmount('');
      setDesc('');
      setSplits({});
      setCurrency('BGN'); // Reset currency
      alert("Приходът е записан успешно (конвертиран в BGN)!");
    };

    const autoFill = (pid: string) => {
       const currentVal = parseFloat((splits[pid] as string) || '0');
       const newVal = (currentVal + remaining).toFixed(2);
       setSplits(prev => ({ ...prev, [pid]: newVal }));
    };

    const setAllTo = (pid: string) => {
      if(totalInput <= 0) return;
      const newSplits: any = {};
      PARTNERS.forEach(p => newSplits[p.id] = '0');
      newSplits[pid] = totalInput.toFixed(2);
      setSplits(newSplits);
    };

    const setHalfPS = () => {
      if(totalInput <= 0) return;
      const half = (totalInput / 2).toFixed(2);
      const newSplits: any = {};
      newSplits['p1'] = half;
      newSplits['p2'] = half;
      newSplits['p3'] = '0';
      setSplits(newSplits);
    };

    const handlePercentChange = (pid: string, percentVal: string) => {
      if(totalInput <= 0) return;
      const pct = parseFloat(percentVal);
      if(!isNaN(pct)) {
        const amt = (totalInput * (pct / 100)).toFixed(2);
        setSplits(prev => ({...prev, [pid]: amt}));
      }
    };

    const activeProject = state.projects.find(p => p.id === projectId);

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
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
             
             {/* Currency Input Component */}
             <div>
               <label className="block text-sm font-medium text-slate-500 mb-2">Сума ({currency})</label>
               <CurrencyInput 
                 amount={amount} 
                 setAmount={setAmount} 
                 currency={currency} 
                 setCurrency={setCurrency} 
                 colorTheme="emerald"
               />
               {currency === 'EUR' && amount && (
                 <p className="text-xs text-slate-400 mt-1">≈ {(parseFloat(amount) * EXCHANGE_RATE_EUR).toFixed(2)} лв.</p>
               )}
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
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
               <div>
                  <span className="text-base font-bold text-emerald-900 flex items-center gap-2">
                    <PieChartIcon className="w-5 h-5" /> Разпределение ({currency})
                  </span>
                  <p className="text-xs text-emerald-700 mt-1">Остатък: <span className={remaining !== 0 ? 'text-red-600 font-bold' : 'text-emerald-600 font-bold'}>{remaining.toFixed(2)} {currency}</span></p>
               </div>
               
               <div className="flex flex-wrap gap-2">
                 <button onClick={setHalfPS} className="px-3 py-1.5 bg-white border border-emerald-200 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-100 transition-colors shadow-sm">
                   50/50 Пламен и Светльо
                 </button>
                 {PARTNERS.map(p => (
                   <button 
                     key={`all-${p.id}`}
                     onClick={() => setAllTo(p.id)} 
                     className="px-3 py-1.5 bg-white border border-emerald-200 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-100 transition-colors shadow-sm"
                   >
                     100% {p.name.split(' ')[0]}
                   </button>
                 ))}
               </div>
             </div>
             
             <div className="space-y-4">
               {PARTNERS.map(p => (
                 <div key={p.id} className="flex flex-col md:flex-row items-center gap-2 md:gap-4 bg-white/50 p-2 rounded-lg">
                   <div className="w-full md:w-32 font-medium text-slate-700">{p.name.split(' ')[0]}:</div>
                   
                   <div className="flex-1 relative w-full">
                     <input 
                        type="number"
                        value={splits[p.id] || ''}
                        onChange={e => setSplits(prev => ({...prev, [p.id]: e.target.value}))}
                        className="w-full rounded-lg border border-slate-200 bg-white p-2 text-right text-slate-700 focus:ring-1 focus:ring-emerald-500 outline-none transition-all placeholder:text-slate-300"
                        placeholder="0.00"
                     />
                     <span className="absolute right-8 top-2 text-slate-400 text-sm pointer-events-none">{currency}</span>
                   </div>

                   <div className="relative w-24">
                      <Percent className="absolute left-2 top-2.5 w-3 h-3 text-slate-400" />
                      <input 
                        type="number"
                        placeholder="%"
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => handlePercentChange(p.id, e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white p-2 pl-6 text-sm text-slate-700 focus:ring-1 focus:ring-emerald-500 outline-none"
                      />
                   </div>

                   <button 
                     onClick={() => autoFill(p.id)}
                     className="p-2 text-emerald-600 hover:bg-emerald-100 rounded-full transition-colors"
                     title="Добави остатъка тук"
                   >
                     <Plus className="w-5 h-5" />
                   </button>
                 </div>
               ))}
             </div>
           </div>

           <div className="mt-6">
             <button 
               onClick={handleSave}
               className="w-full bg-emerald-600 text-white py-4 rounded-xl text-lg font-bold shadow-lg hover:bg-emerald-700 transition-transform active:scale-95 flex items-center justify-center gap-2"
             >
               <Save className="w-6 h-6" /> Запиши Приход
             </button>
           </div>
        </div>
      </div>
    );
  };

  const ExpensesView = () => {
    const [desc, setDesc] = useState<string>('');
    const [amount, setAmount] = useState<string>('');
    const [currency, setCurrency] = useState<'BGN' | 'EUR'>('BGN');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
    const [distType, setDistType] = useState<'general' | 'plamen_svetlo' | 'individual'>('plamen_svetlo');
    const [selectedPartner, setSelectedPartner] = useState(PARTNERS[0].id);

    const handleSave = () => {
      const inputVal = parseFloat(amount);
      if (!inputVal || !desc) return;

      const rate = currency === 'EUR' ? EXCHANGE_RATE_EUR : 1;
      const finalValInBgn = inputVal * rate;

      let distributions: {partnerId: string, amount: number}[] = [];

      if (distType === 'plamen_svetlo') {
        const half = finalValInBgn / 2;
        distributions = [
          { partnerId: 'p1', amount: half },
          { partnerId: 'p2', amount: half }
        ];
      } else if (distType === 'general') {
        // Explicitly distribute for general expenses if needed, or leave empty for auto-calc
        // Based on calculateFinancials, empty array means equal split.
      } else if (distType === 'individual') {
        distributions = [{ partnerId: selectedPartner, amount: finalValInBgn }];
      }

      addExpense(desc, finalValInBgn, date, category, distributions);
      setAmount('');
      setDesc('');
      setCurrency('BGN');
      alert("Разходът е записан!");
    };

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <SectionTitle icon={Receipt} color="text-red-500">Въвеждане на Разход</SectionTitle>

        <div className="bg-white p-6 rounded-xl shadow-md border-t-4 border-red-500">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="col-span-1 md:col-span-2">
               <label className="block text-sm font-medium text-slate-500 mb-2">Описание на разхода</label>
               <input 
                 value={desc} 
                 onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDesc(e.target.value)} 
                 className="w-full rounded-lg border-red-200 border bg-white p-3 text-base text-slate-700 focus:ring-2 focus:ring-red-100 focus:border-red-400 outline-none transition-all placeholder:text-slate-300"
                 placeholder="Напр. Закупуване на лазерен нивелир..." 
               />
             </div>
             
             <div>
               <label className="block text-sm font-medium text-slate-500 mb-2">Сума ({currency})</label>
               <CurrencyInput 
                 amount={amount}
                 setAmount={setAmount}
                 currency={currency}
                 setCurrency={setCurrency}
                 colorTheme="red"
               />
                {currency === 'EUR' && amount && (
                 <p className="text-xs text-slate-400 mt-1">≈ {(parseFloat(amount) * EXCHANGE_RATE_EUR).toFixed(2)} лв.</p>
               )}
             </div>

             <div>
                <label className="block text-sm font-medium text-slate-500 mb-2">Категория</label>
                <select 
                  value={category} 
                  onChange={e => setCategory(e.target.value)}
                  className="w-full rounded-lg border-red-200 border bg-white p-3 text-base text-slate-700 focus:ring-2 focus:ring-red-100 focus:border-red-400 outline-none transition-all"
                >
                  {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
             </div>

             <div className="col-span-1 md:col-span-2 bg-red-50 p-6 rounded-xl border border-red-100">
               <label className="block text-base font-bold text-red-900 mb-4 flex items-center gap-2">
                 <Users className="w-5 h-5" /> Кой поема разхода?
               </label>
               
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <button 
                   onClick={() => setDistType('plamen_svetlo')}
                   className={`p-4 rounded-xl border-2 text-left transition-all ${distType === 'plamen_svetlo' ? 'border-red-500 bg-white shadow-md' : 'border-transparent hover:bg-red-100/50'}`}
                 >
                   <div className="font-bold text-slate-800">Пламен + Светльо</div>
                   <div className="text-xs text-slate-500 mt-1">Дели се 50/50 между конструкторите</div>
                 </button>

                 <button 
                   onClick={() => setDistType('general')}
                   className={`p-4 rounded-xl border-2 text-left transition-all ${distType === 'general' ? 'border-red-500 bg-white shadow-md' : 'border-transparent hover:bg-red-100/50'}`}
                 >
                   <div className="font-bold text-slate-800">Общ (Фирмен)</div>
                   <div className="text-xs text-slate-500 mt-1">Дели се по равно между всички (3)</div>
                 </button>

                 <button 
                   onClick={() => setDistType('individual')}
                   className={`p-4 rounded-xl border-2 text-left transition-all ${distType === 'individual' ? 'border-red-500 bg-white shadow-md' : 'border-transparent hover:bg-red-100/50'}`}
                 >
                   <div className="font-bold text-slate-800">Индивидуален</div>
                   <div className="text-xs text-slate-500 mt-1">Само за един човек</div>
                 </button>
               </div>

               {distType === 'individual' && (
                 <div className="mt-4 animate-in fade-in slide-in-from-top-2">
                   <label className="block text-sm font-medium text-slate-600 mb-2">Избери човек:</label>
                   <select 
                     value={selectedPartner}
                     onChange={e => setSelectedPartner(e.target.value)}
                     className="w-full md:w-1/2 rounded-lg border-red-200 border bg-white p-2 text-slate-700 outline-none"
                   >
                     {PARTNERS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                   </select>
                 </div>
               )}
             </div>
           </div>

           <div className="mt-6">
             <button 
               onClick={handleSave}
               className="w-full bg-red-500 text-white py-4 rounded-xl text-lg font-bold shadow-lg hover:bg-red-600 transition-transform active:scale-95 flex items-center justify-center gap-2"
             >
               <Save className="w-6 h-6" /> Запиши Разход
             </button>
           </div>
        </div>

        <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
               <tr>
                 <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Дата</th>
                 <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Описание</th>
                 <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Сума</th>
                 <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Категория</th>
               </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {state.expenses.slice().reverse().map(e => (
                <tr key={e.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{e.date}</td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-800">{e.description}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-600">
                    <div>-{e.amount.toFixed(2)} лв.</div>
                    <div className="text-xs text-slate-400 font-normal">(-{toEuroStr(e.amount)})</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    <span className="px-2 py-1 bg-slate-100 rounded-full text-xs">{e.category}</span>
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
    const [selectedPid, setSelectedPid] = useState(PARTNERS[0].id);
    const [grossAmount, setGrossAmount] = useState('');
    const [currency, setCurrency] = useState<'BGN' | 'EUR'>('BGN');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    const handlePay = () => {
      const inputVal = parseFloat(grossAmount);
      if (!inputVal) return;

      const rate = currency === 'EUR' ? EXCHANGE_RATE_EUR : 1;
      const finalValInBgn = inputVal * rate;

      addDividend(selectedPid, finalValInBgn, date);
      setGrossAmount('');
      setCurrency('BGN');
      alert("Дивидентът е записан успешно!");
    };

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <SectionTitle icon={CheckCircle2} color="text-purple-600">Дивиденти и Печалба</SectionTitle>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           {financials.partnerStats.map(p => (
             <div key={p.partnerId} className="bg-white p-6 rounded-xl shadow-md border border-slate-100 flex flex-col justify-between">
               <div>
                 <h3 className="text-lg font-bold text-slate-700 mb-1">{p.name}</h3>
                 <div className="text-sm text-slate-400 mb-4">Баланс за теглене</div>
                 <div className="text-3xl font-extrabold text-emerald-600 mb-2">
                   {p.balance.toLocaleString('bg-BG', { style: 'currency', currency: 'BGN' })}
                 </div>
                 <div className="text-sm text-emerald-400 font-medium mb-4">
                   {toEuroStr(p.balance)}
                 </div>
                 <div className="space-y-1 text-xs text-slate-500">
                   <div className="flex justify-between"><span>Генериран приход:</span> <span>{p.revenue.toFixed(0)} лв.</span></div>
                   <div className="flex justify-between"><span>Дял разходи:</span> <span>-{p.expenseShare.toFixed(0)} лв.</span></div>
                   <div className="flex justify-between"><span>Корп. данък:</span> <span>-{p.corporateTaxShare.toFixed(0)} лв.</span></div>
                   <div className="flex justify-between font-medium text-purple-600"><span>Изтеглени дивиденти:</span> <span>-{p.dividendsTakenGross.toFixed(0)} лв.</span></div>
                 </div>
               </div>
             </div>
           ))}
        </div>

        <div className="bg-white p-6 rounded-xl shadow-md border-t-4 border-purple-500">
           <h3 className="text-lg font-bold text-slate-700 mb-6">Изплащане на Дивидент</h3>
           <div className="flex flex-col md:flex-row gap-4 items-end">
             <div className="flex-1 w-full">
               <label className="block text-sm font-medium text-slate-500 mb-2">Получател</label>
               <select 
                 value={selectedPid} 
                 onChange={e => setSelectedPid(e.target.value)}
                 className="w-full rounded-lg border-purple-200 border bg-white p-3 text-base text-slate-700 outline-none focus:ring-2 focus:ring-purple-200"
               >
                 {PARTNERS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
               </select>
             </div>
             <div className="flex-1 w-full">
               <label className="block text-sm font-medium text-slate-500 mb-2">Сума ({currency})</label>
               <CurrencyInput 
                 amount={grossAmount}
                 setAmount={setGrossAmount}
                 currency={currency}
                 setCurrency={setCurrency}
                 colorTheme="purple"
               />
             </div>
             <div className="flex-1 w-full">
                <label className="block text-sm font-medium text-slate-500 mb-2">Дата</label>
                <input 
                  type="date" 
                  value={date} 
                  onChange={e => setDate(e.target.value)} 
                  className="w-full rounded-lg border-purple-200 border bg-white p-3 text-base text-slate-700 outline-none focus:ring-2 focus:ring-purple-200"
                />
             </div>
             <button 
               onClick={handlePay}
               className="bg-purple-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-purple-700 shadow transition-all w-full md:w-auto"
             >
               Изплати
             </button>
           </div>
           {grossAmount && !isNaN(parseFloat(grossAmount)) && (
             <div className="mt-4 p-4 bg-purple-50 rounded-lg text-sm text-purple-900 border border-purple-100">
               <span className="font-bold">Калкулация ({currency}):</span> При сума {grossAmount} {currency}, данък дивидент (5%) е <span className="font-bold">{(parseFloat(grossAmount) * 0.05).toFixed(2)} {currency}</span>. Получателят ще вземе чисти <span className="font-bold">{(parseFloat(grossAmount) * 0.95).toFixed(2)} {currency}</span>.
             </div>
           )}
        </div>
      </div>
    );
  };

  const ReportsView = () => {
    // Determine default dates (current month)
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

    const [startDate, setStartDate] = useState(firstDay);
    const [endDate, setEndDate] = useState(lastDay);

    // Filter Logic
    const periodData = useMemo(() => {
      const payments = state.payments.filter(p => p.date >= startDate && p.date <= endDate);
      const expenses = state.expenses.filter(e => e.date >= startDate && e.date <= endDate);
      const dividendTaxes = state.dividends.filter(d => d.date >= startDate && d.date <= endDate);
      
      const revenue = payments.reduce((sum, p) => sum + p.totalAmount, 0);
      const expenseTotal = expenses.reduce((sum, e) => sum + e.amount, 0);
      
      const profitBeforeTax = revenue - expenseTotal;
      const tax = profitBeforeTax > 0 ? profitBeforeTax * 0.10 : 0;
      const netProfit = profitBeforeTax - tax;
      const dividendTax = dividendTaxes.reduce((sum, d) => sum + d.taxAmount, 0);

      // Breakdowns
      const byProject: Record<string, number> = {};
      payments.forEach(p => {
         const projName = state.projects.find(proj => proj.id === p.projectId)?.name || 'Неизвестен';
         byProject[projName] = (byProject[projName] || 0) + p.totalAmount;
      });

      const byCategory: Record<string, number> = {};
      expenses.forEach(e => {
        byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
      });

      return { revenue, expenseTotal, profitBeforeTax, tax, netProfit, byProject, byCategory, dividendTax };
    }, [state, startDate, endDate]);

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <SectionTitle icon={FileText} color="text-blue-600">Периодичен Отчет</SectionTitle>
          <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors font-medium">
             <Printer className="w-5 h-5" /> Печат
          </button>
        </div>
        
        {/* Date Filters */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="block text-sm font-medium text-slate-500 mb-1 flex items-center gap-2"><Calendar className="w-4 h-4" /> От дата</label>
            <input 
              type="date" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)} 
              className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex-1 w-full">
            <label className="block text-sm font-medium text-slate-500 mb-1 flex items-center gap-2"><Calendar className="w-4 h-4" /> До дата</label>
            <input 
              type="date" 
              value={endDate} 
              onChange={e => setEndDate(e.target.value)} 
              className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Report Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 print:grid-cols-5">
           <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
             <div className="text-emerald-800 text-sm font-bold uppercase">Приходи</div>
             <div className="text-2xl font-bold text-emerald-600">{periodData.revenue.toLocaleString('bg-BG', {style: 'currency', currency: 'BGN'})}</div>
           </div>
           <div className="bg-red-50 p-4 rounded-xl border border-red-100">
             <div className="text-red-800 text-sm font-bold uppercase">Разходи</div>
             <div className="text-2xl font-bold text-red-600">-{periodData.expenseTotal.toLocaleString('bg-BG', {style: 'currency', currency: 'BGN'})}</div>
           </div>
           <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
             <div className="text-amber-800 text-sm font-bold uppercase">Корп. Данък (10%)</div>
             <div className="text-2xl font-bold text-amber-600">-{periodData.tax.toLocaleString('bg-BG', {style: 'currency', currency: 'BGN'})}</div>
           </div>
           <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
             <div className="text-purple-800 text-sm font-bold uppercase">Данък Дивидент (5%)</div>
             <div className="text-2xl font-bold text-purple-600">-{periodData.dividendTax.toLocaleString('bg-BG', {style: 'currency', currency: 'BGN'})}</div>
           </div>
           <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
             <div className="text-blue-800 text-sm font-bold uppercase">Нетна Печалба</div>
             <div className="text-2xl font-bold text-blue-600">{periodData.netProfit.toLocaleString('bg-BG', {style: 'currency', currency: 'BGN'})}</div>
           </div>
        </div>

        {/* Detailed Breakdown Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:grid-cols-2">
           {/* Income Breakdown */}
           <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
             <div className="bg-emerald-600 text-white p-3 font-bold">Приходи по Проекти</div>
             <table className="min-w-full divide-y divide-slate-100">
               <tbody className="divide-y divide-slate-100">
                 {Object.entries(periodData.byProject).length > 0 ? (
                   Object.entries(periodData.byProject).map(([name, val]) => (
                     <tr key={name}>
                       <td className="px-4 py-3 text-sm text-slate-700">{name}</td>
                       <td className="px-4 py-3 text-sm font-bold text-slate-900 text-right">{(val as number).toLocaleString('bg-BG', {style:'currency', currency:'BGN'})}</td>
                     </tr>
                   ))
                 ) : (
                   <tr><td colSpan={2} className="px-4 py-3 text-sm text-slate-400 text-center">Няма приходи за периода</td></tr>
                 )}
               </tbody>
             </table>
           </div>

           {/* Expense Breakdown */}
           <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
             <div className="bg-red-500 text-white p-3 font-bold">Разходи по Категории</div>
             <table className="min-w-full divide-y divide-slate-100">
               <tbody className="divide-y divide-slate-100">
                 {Object.entries(periodData.byCategory).length > 0 ? (
                   Object.entries(periodData.byCategory).map(([cat, val]) => (
                     <tr key={cat}>
                       <td className="px-4 py-3 text-sm text-slate-700">{cat}</td>
                       <td className="px-4 py-3 text-sm font-bold text-slate-900 text-right">{(val as number).toLocaleString('bg-BG', {style:'currency', currency:'BGN'})}</td>
                     </tr>
                   ))
                 ) : (
                   <tr><td colSpan={2} className="px-4 py-3 text-sm text-slate-400 text-center">Няма разходи за периода</td></tr>
                 )}
               </tbody>
             </table>
           </div>
        </div>
      </div>
    );
  };

  const SettingsView = () => (
    <div className="space-y-6 animate-in fade-in duration-300">
      <SectionTitle icon={Settings} color="text-slate-600">Настройки</SectionTitle>
      
      <div className="bg-white p-6 rounded-xl shadow-md border border-slate-100">
        <h3 className="text-lg font-bold text-slate-700 mb-4">Управление на данни</h3>
        <p className="text-slate-500 mb-6">Можете да направите резервно копие на всички данни или да заредите такова от файл.</p>
        
        <div className="flex flex-col md:flex-row gap-4">
          <button 
            onClick={handleExport}
            className="flex-1 bg-indigo-50 text-indigo-700 border border-indigo-200 px-6 py-4 rounded-xl font-bold hover:bg-indigo-100 flex items-center justify-center gap-3 transition-colors"
          >
            <Download className="w-6 h-6" /> Експорт (Backup)
          </button>
          
          <label className="flex-1 bg-slate-50 text-slate-700 border border-slate-200 px-6 py-4 rounded-xl font-bold hover:bg-slate-100 flex items-center justify-center gap-3 cursor-pointer transition-colors">
            <Upload className="w-6 h-6" /> Импорт
            <input type="file" onChange={handleImport} className="hidden" accept=".json" />
          </label>
        </div>

        <div className="mt-8 pt-8 border-t border-slate-100">
          <h4 className="text-red-600 font-bold mb-2">Опасна зона</h4>
          <button 
            onClick={() => { if(window.confirm('Сигурни ли сте? Това ще изтрие ВСИЧКИ данни!')) setState(INITIAL_STATE); }}
            className="text-red-500 hover:text-red-700 text-sm font-medium underline"
          >
            Нулиране на приложението
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Sidebar Navigation */}
      <nav className="bg-slate-900 text-slate-300 w-full md:w-72 flex-shrink-0 flex flex-col print:hidden">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-2xl font-bold text-white tracking-tight">Dimov<span className="text-blue-500">Finance</span></h1>
          <p className="text-xs text-slate-500 mt-1">Семейно счетоводство</p>
        </div>
        
        <div className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
          {[
            { id: 'dashboard', label: 'Табло', icon: LayoutDashboard },
            { id: 'projects', label: 'Проекти', icon: Briefcase },
            { id: 'income', label: 'Приходи', icon: Wallet },
            { id: 'expenses', label: 'Разходи', icon: Receipt },
            { id: 'dividends', label: 'Дивиденти', icon: CheckCircle2 },
            { id: 'reports', label: 'Отчети', icon: FileText },
            { id: 'settings', label: 'Настройки', icon: Settings },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 font-medium ${
                activeTab === item.id 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' 
                  : 'hover:bg-slate-800 hover:text-white'
              }`}
            >
              <item.icon className={`w-5 h-5 ${activeTab === item.id ? 'text-white' : 'text-slate-500'}`} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        <div className="p-4 border-t border-slate-800 text-xs text-slate-600 text-center">
          v2.0 • 2025
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 print:p-0 print:overflow-visible">
        <div className="max-w-7xl mx-auto">
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