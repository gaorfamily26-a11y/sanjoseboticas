import React, { useMemo } from 'react';
import { 
  TrendingUp, Package, Activity, Wallet, ShoppingBag, 
  BarChart3, ArrowUpRight, Award, Target, Zap
} from 'lucide-react';
import { OdooStatCard } from './StatCard';

interface DashboardProps {
  posConfigs: any[];
  posSalesData: any;
  lastSync: string;
}

export const Dashboard: React.FC<DashboardProps> = ({ posConfigs, posSalesData, lastSync }) => {
  
  // Agregación de Datos Globales (Inteligencia de Cadena)
  const analytics = useMemo(() => {
    let globalTotal = 0;
    let globalTickets = 0;
    let activePoints = 0;
    const globalPayments: Record<string, number> = {};
    const globalProducts: Record<string, {name: string, qty: number, total: number}> = {};

    Object.values(posSalesData).forEach((stats: any) => {
      globalTotal += stats.totalSales || 0;
      globalTickets += stats.count || 0;
      if (stats.isOnline) activePoints++;

      // Consolidar Pagos
      Object.entries(stats.payments || {}).forEach(([method, amount]) => {
        globalPayments[method] = (globalPayments[method] || 0) + (amount as number);
      });

      // Consolidar Productos
      (stats.topProducts || []).forEach((p: any) => {
        if (!globalProducts[p.name]) globalProducts[p.name] = { name: p.name, qty: 0, total: 0 };
        globalProducts[p.name].qty += p.qty;
        globalProducts[p.name].total += p.total;
      });
    });

    const topProducts = Object.values(globalProducts)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);

    const rankingSedes = posConfigs
      .map(c => ({
        id: c.id,
        name: c.name,
        sales: posSalesData[c.id]?.totalSales || 0,
        tickets: posSalesData[c.id]?.count || 0,
        avgTicket: posSalesData[c.id]?.count > 0 ? (posSalesData[c.id].totalSales / posSalesData[c.id].count) : 0,
        isOnline: posSalesData[c.id]?.isOnline
      }))
      .sort((a, b) => b.sales - a.sales);

    return { globalTotal, globalTickets, activePoints, globalPayments, topProducts, rankingSedes };
  }, [posConfigs, posSalesData]);

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 animate-fade pb-12">
      {/* KPIs Macro */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <OdooStatCard title="Venta Total Cadena" value={`S/ ${analytics.globalTotal.toLocaleString('es-PE', {minimumFractionDigits: 2})}`} icon={TrendingUp} active />
        <OdooStatCard title="Tickets Emitidos" value={analytics.globalTickets} icon={Package} />
        <OdooStatCard title="Sedes en Línea" value={`${analytics.activePoints} / ${posConfigs.length}`} icon={Activity} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* COLUMNA IZQUIERDA: Monitor de Sedes (Principal) */}
        <div className="xl:col-span-8 space-y-6">
          <div className="bg-white border border-odoo-border rounded-odoo-lg shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b bg-gray-50 flex justify-between items-center">
               <h3 className="text-sm font-black text-gray-700 uppercase tracking-tight flex items-center gap-2">
                 <Zap size={16} className="text-odoo-primary"/> Monitor de Rendimiento por Sede
               </h3>
               <span className="text-[10px] font-bold text-gray-400 uppercase">Sync: {lastSync}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase border-b">
                  <tr>
                    <th className="px-6 py-4">Sede / Botica</th>
                    <th className="px-6 py-4 text-center">Estado</th>
                    <th className="px-6 py-4 text-right">Ticket Prom.</th>
                    <th className="px-6 py-4 text-right">Participación</th>
                    <th className="px-6 py-4 text-right">Venta Hoy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {analytics.rankingSedes.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-gray-700 uppercase">{item.name}</span>
                          <span className="text-[9px] text-gray-400 font-bold uppercase">{item.tickets} Operaciones</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                         <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full ${item.isOnline ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                           <div className={`w-1.5 h-1.5 rounded-full ${item.isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                           <span className="text-[9px] font-black uppercase">{item.isOnline ? 'Online' : 'Off'}</span>
                         </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-xs font-bold text-odoo-primary">S/ {item.avgTicket.toFixed(2)}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] font-black text-gray-400">
                            {analytics.globalTotal > 0 ? ((item.sales / analytics.globalTotal) * 100).toFixed(1) : 0}%
                          </span>
                          <div className="w-12 h-1 bg-gray-100 rounded-full mt-1 overflow-hidden">
                             <div className="h-full bg-odoo-primary/40" style={{ width: `${(item.sales / analytics.globalTotal) * 100}%` }}></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-sm font-black text-gray-800">S/ {item.sales.toLocaleString('es-PE', {minimumFractionDigits: 2})}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Top 10 Productos Globales (Cuerpo) */}
          <div className="bg-white border border-odoo-border rounded-odoo-lg shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b bg-odoo-primary text-white flex justify-between items-center">
               <h3 className="text-sm font-bold uppercase flex items-center gap-2">
                 <ShoppingBag size={16}/> Top 10 Productos Más Vendidos (Hoy)
               </h3>
               <span className="text-[10px] font-black opacity-60 uppercase tracking-widest">Consolidado Cadena</span>
            </div>
            <div className="p-0">
               <table className="w-full text-left">
                  <thead className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase border-b">
                    <tr>
                      <th className="px-6 py-3 w-12">#</th>
                      <th className="px-6 py-3">Medicamento / Producto</th>
                      <th className="px-6 py-3 text-right">Cantidad</th>
                      <th className="px-6 py-3 text-right">Recaudación</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {analytics.topProducts.map((p, i) => (
                      <tr key={i} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-3 font-black text-gray-300 text-xs">{i + 1}</td>
                        <td className="px-6 py-3">
                          <span className="text-[11px] font-bold text-gray-700 uppercase">{p.name}</span>
                        </td>
                        <td className="px-6 py-3 text-right">
                          <span className="text-xs font-black text-gray-500">{p.qty} <span className="text-[9px] opacity-50 uppercase">Und</span></span>
                        </td>
                        <td className="px-6 py-3 text-right font-bold text-gray-800 text-xs">S/ {p.total.toLocaleString('es-PE', {minimumFractionDigits: 2})}</td>
                      </tr>
                    ))}
                    {analytics.topProducts.length === 0 && (
                      <tr><td colSpan={4} className="py-12 text-center text-xs text-gray-400 italic">No hay datos de productos procesados</td></tr>
                    )}
                  </tbody>
               </table>
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA: Mix de Pagos y Metas */}
        <div className="xl:col-span-4 space-y-6">
          <div className="bg-white border border-odoo-border rounded-odoo-lg shadow-sm p-6">
            <h3 className="text-[10px] font-black text-gray-500 uppercase mb-6 flex items-center gap-2 tracking-[0.2em]">
              <Wallet size={16} className="text-odoo-primary"/> Mix de Liquidez Global
            </h3>
            <div className="space-y-6">
              {/* Fix: Explicitly cast Object.entries to [string, number][] to avoid arithmetic and toLocaleString TS errors */}
              {(Object.entries(analytics.globalPayments) as [string, number][]).sort((a, b) => b[1] - a[1]).map(([method, amount], i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-black text-gray-500 uppercase">{method}</span>
                    <span className="text-xs font-black text-gray-800">S/ {amount.toLocaleString('es-PE', {minimumFractionDigits: 2})}</span>
                  </div>
                  <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-odoo-primary h-full transition-all duration-1000" style={{ width: `${(amount / analytics.globalTotal) * 100}%` }}></div>
                  </div>
                  <div className="flex justify-between text-[9px] font-bold text-gray-400 uppercase">
                    <span>Participación</span>
                    <span>{((amount / analytics.globalTotal) * 100).toFixed(1)}%</span>
                  </div>
                </div>
              ))}
              {Object.keys(analytics.globalPayments).length === 0 && (
                <div className="py-10 text-center opacity-30 italic text-xs">Esperando transacciones...</div>
              )}
            </div>
          </div>

          <div className="bg-gradient-to-br from-odoo-primary to-purple-900 rounded-odoo-lg shadow-lg p-6 text-white overflow-hidden relative group">
             <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                <Award size={80}/>
             </div>
             <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-4 flex items-center gap-2 opacity-80">
               <Target size={14}/> Top Performance Sede
             </h3>
             {analytics.rankingSedes[0] ? (
               <div className="space-y-4">
                  <div>
                    <p className="text-2xl font-black uppercase leading-tight">{analytics.rankingSedes[0].name}</p>
                    <p className="text-[10px] font-bold opacity-60 uppercase mt-1">Líder de Ventas del Día</p>
                  </div>
                  <div className="pt-4 border-t border-white/10 flex justify-between items-end">
                     <div>
                        <p className="text-[10px] font-bold opacity-60 uppercase">Venta Acumulada</p>
                        <p className="text-xl font-black">S/ {analytics.rankingSedes[0].sales.toLocaleString('es-PE', {minimumFractionDigits: 2})}</p>
                     </div>
                     <div className="text-right">
                        <p className="text-[10px] font-bold opacity-60 uppercase">Tickets</p>
                        <p className="text-xl font-black">{analytics.rankingSedes[0].tickets}</p>
                     </div>
                  </div>
               </div>
             ) : (
               <p className="text-xs italic opacity-50">Calculando líder del día...</p>
             )}
          </div>
        </div>

      </div>
    </div>
  );
};