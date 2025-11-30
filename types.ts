export interface Partner {
  id: string;
  name: string;
  role: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  type: 'construction' | 'electrical'; // New field
  status: 'active' | 'completed';
  createdAt: string;
}

export interface Distribution {
  partnerId: string;
  amount: number;
}

export interface Payment {
  id: string;
  projectId: string;
  date: string;
  description: string;
  totalAmount: number;
  distributions: Distribution[];
}

export interface Expense {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  distributions: Distribution[]; 
}

export interface DividendPayout {
  id: string;
  partnerId: string;
  date: string;
  grossAmount: number; 
  taxAmount: number;   
  netReceived: number; 
}

export interface AppState {
  projects: Project[];
  payments: Payment[];
  expenses: Expense[];
  dividends: DividendPayout[];
}

export interface FinancialSummary {
  totalRevenue: number;
  totalExpenses: number;
  taxableProfit: number;
  corporateTax: number;
  netProfit: number;
}

export interface PartnerFinancials {
  partnerId: string;
  name: string;
  revenue: number; 
  expenseShare: number; 
  taxableBase: number;
  corporateTaxShare: number;
  netProfitShare: number; 
  dividendsTakenGross: number;
  dividendTaxPaid: number;
  balance: number; 
}