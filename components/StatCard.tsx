
import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  onClick?: () => void;
  active?: boolean;
}

export const OdooStatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, onClick, active }) => (
  <div 
    onClick={onClick}
    className={`flex-1 min-w-[200px] bg-white border ${active ? 'border-odoo-primary' : 'border-odoo-border'} p-5 rounded-odoo shadow-sm hover:shadow-md transition-all cursor-pointer group`}
  >
    <div className="flex items-center justify-between mb-2">
      <p className="text-[11px] font-black text-gray-500 uppercase tracking-wider">{title}</p>
      <div className={`p-2 rounded-full ${active ? 'bg-odoo-primary/10 text-odoo-primary' : 'bg-gray-50 text-gray-400 group-hover:text-odoo-primary'}`}>
        <Icon size={16} />
      </div>
    </div>
    <div className="flex items-baseline gap-1">
      <h3 className="text-2xl font-bold text-gray-800">{value}</h3>
    </div>
    <div className="mt-2 h-1 w-full bg-gray-100 rounded-full overflow-hidden">
       <div className={`h-full ${active ? 'bg-odoo-primary' : 'bg-gray-300'} w-2/3`}></div>
    </div>
  </div>
);
