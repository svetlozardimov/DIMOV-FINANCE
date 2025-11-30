import React from 'react';
import { LucideIcon } from 'lucide-react';

interface FinancialCardProps {
  title: string;
  amount: number;
  icon: LucideIcon;
  colorClass: string;
  subtitle?: string;
}

export const FinancialCard: React.FC<FinancialCardProps> = ({ title, amount, icon: Icon, colorClass, subtitle }) => {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center space-x-4">
      <div className={`p-3 rounded-full ${colorClass} bg-opacity-10`}>
        <Icon className={`w-8 h-8 ${colorClass.replace('bg-', 'text-')}`} />
      </div>
      <div>
        <p className="text-sm text-slate-500 font-medium">{title}</p>
        <h3 className="text-2xl font-bold text-slate-800">
          {amount.toLocaleString('bg-BG', { style: 'currency', currency: 'BGN' })}
        </h3>
        {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
      </div>
    </div>
  );
};