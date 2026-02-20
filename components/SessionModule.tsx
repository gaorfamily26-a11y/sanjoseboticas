
import React from 'react';
import { Clock, UserCheck, Calendar, ShieldCheck, Activity, MapPin } from 'lucide-react';

interface SessionModuleProps {
  activeSessions: any[];
  loading: boolean;
}

export const SessionModule: React.FC<SessionModuleProps> = ({ activeSessions, loading }) => {
  const formatOdooDate = (dateStr: string) => {
    if (!dateStr) return { date: '-', time: '-' };
    const date = new Date(dateStr + 'Z'); // Add Z for UTC
    const local = new Date(date.getTime()); 
    return {
      date: local.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      time: local.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true })
    };
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 animate-fade pb-12">
      <div className="flex flex-col md:row justify-between items-start md:items-center gap-4 bg-white p-5 border border-odoo-border rounded shadow-sm">
         <div>
            <h2 className="text-xl font-bold text-gray-700 uppercase">Estado de Sesiones POS</h2>
            <p className="text-xs font-semibold text-gray-400 mt-1 uppercase tracking-widest flex items-center gap-2">
               <Activity size={14} className="text-green-500" /> Control de Puntos de Venta Activos
            </p>
         </div>
         <div className="flex items-center gap-3">
            <span className="text-[10px] font-black bg-green-100 text-green-700 px-3 py-1.5 rounded-full uppercase">
               {activeSessions.length} Cajas Abiertas
            </span>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
         {activeSessions.length === 0 && !loading ? (
            <div className="col-span-full py-20 bg-white border border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center opacity-50">
               <Clock size={48} className="text-gray-400 mb-4" />
               <p className="text-sm font-bold uppercase text-gray-500 tracking-widest">No hay sesiones abiertas en este momento</p>
            </div>
         ) : activeSessions.map(session => {
            const { date, time } = formatOdooDate(session.start_at);
            const posName = Array.isArray(session.config_id) ? session.config_id[1] : 'S/N';
            const userName = Array.isArray(session.user_id) ? session.user_id[1] : 'Usuario Odoo';

            return (
               <div key={session.id} className="bg-white border-l-4 border-l-odoo-primary border border-odoo-border rounded shadow-sm hover:shadow-md transition-all overflow-hidden">
                  <div className="px-5 py-4 border-b bg-gray-50/50 flex justify-between items-center">
                     <div className="flex items-center gap-2">
                        <MapPin size={16} className="text-odoo-primary" />
                        <h4 className="font-bold text-gray-700 uppercase text-xs truncate max-w-[180px]">{posName}</h4>
                     </div>
                     <span className="text-[9px] font-black bg-green-500 text-white px-2 py-0.5 rounded uppercase animate-pulse">Abierto</span>
                  </div>
                  <div className="p-5 space-y-4">
                     <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-odoo-primary/10 flex items-center justify-center text-odoo-primary">
                           <UserCheck size={20} />
                        </div>
                        <div className="flex-1">
                           <p className="text-[10px] font-bold text-gray-400 uppercase leading-none mb-1">Aperturado por</p>
                           <p className="text-sm font-bold text-gray-800 uppercase leading-tight">{userName}</p>
                        </div>
                     </div>
                     <div className="grid grid-cols-2 gap-3 pt-2">
                        <div className="bg-gray-50 p-2.5 rounded border border-gray-100">
                           <div className="flex items-center gap-1.5 mb-1">
                              <Calendar size={12} className="text-gray-400" />
                              <span className="text-[9px] font-bold text-gray-400 uppercase">Fecha</span>
                           </div>
                           <p className="text-xs font-black text-gray-700">{date}</p>
                        </div>
                        <div className="bg-gray-50 p-2.5 rounded border border-gray-100">
                           <div className="flex items-center gap-1.5 mb-1">
                              <Clock size={12} className="text-gray-400" />
                              <span className="text-[9px] font-bold text-gray-400 uppercase">Hora inicio</span>
                           </div>
                           <p className="text-xs font-black text-gray-700">{time}</p>
                        </div>
                     </div>
                  </div>
                  <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
                     <span className="text-[10px] font-bold text-gray-400 italic">Sesión #{session.id}</span>
                     <ShieldCheck size={14} className="text-green-500" />
                  </div>
               </div>
            );
         })}
      </div>
    </div>
  );
};
