import { Partner, AppState } from './types';

export const PARTNERS: Partner[] = [
  { id: 'p1', name: 'Пламен Димов', role: 'Управител' },
  { id: 'p2', name: 'Светлозар Димов', role: 'Конструктор' },
  { id: 'p3', name: 'Димо Димов', role: 'Електро проектант' },
];

export const INITIAL_STATE: AppState = {
  projects: [],
  payments: [],
  expenses: [],
  dividends: [],
};

export const EXPENSE_CATEGORIES = [
  'Офис консумативи',
  'Наем',
  'Софтуер',
  'Оборудване',
  'Транспорт',
  'Други',
];

export const TAX_RATE = 0.10; // 10% Corporate Tax
export const DIVIDEND_TAX_RATE = 0.05; // 5% Dividend Tax