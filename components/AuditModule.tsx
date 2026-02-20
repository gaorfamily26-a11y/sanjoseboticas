
import React, { useMemo, useState } from 'react';
import { 
  FileSpreadsheet, Store, X, Package, ListChecks, Download, 
  ChevronRight, TrendingUp, Users, CreditCard, BarChart3, 
  PieChart as PieIcon, ArrowUpRight, ArrowDownRight, Info,
  Medal, ShoppingBag, Wallet, Calendar, Loader2
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts';
import ExcelJS from 'exceljs';
import saveAs from 'file-saver';

interface AuditModuleProps {
  posConfigs: any[];
  posSalesData: any;
  rawOrders: any[];
  rawLines: any[];
  rawPayments: any[];
  onSelect: (pos: any) => void;
  selectedPos: any | null;
  onCloseDetail: () => void;
}

export const AuditModule: React.FC<AuditModuleProps> = ({ 
  posConfigs, 
  posSalesData, 
  rawOrders, 
  rawLines, 
  rawPayments, 
  onSelect, 
  selectedPos, 
  onCloseDetail 
}) => {
  const [exporting, setExporting] = useState(false);

  const reportData = useMemo(() => {
    const data = posConfigs.map(c => {
      const stats = posSalesData[c.id] || { totalSales: 0, count: 0, topProducts: [], payments: {} };
      return {
        id: c.id,
        name: c.name,
        total: stats.totalSales || 0,
        tickets: stats.count || 0,
        avgTicket: stats.count > 0 ? (stats.totalSales / stats.count) : 0,
        state: stats.isOnline ? 'opened' : 'closed',
        topProducts: stats.topProducts || [],
        payments: stats.payments || {}
      };
    }).sort((a, b) => b.total - a.total);

    const totalGlobal = data.reduce((acc, curr) => acc + curr.total, 0);
    const totalTicketsGlobal = data.reduce((acc, curr) => acc + curr.tickets, 0);

    const globalPayments: Record<string, number> = {};
    data.forEach(item => {
      Object.entries(item.payments).forEach(([method, amount]) => {
        globalPayments[method] = (globalPayments[method] || 0) + (amount as number);
      });
    });

    return {
      items: data,
      totalGlobal,
      totalTicketsGlobal,
      avgTicketGlobal: totalTicketsGlobal > 0 ? totalGlobal / totalTicketsGlobal : 0,
      globalPayments
    };
  }, [posConfigs, posSalesData]);

  const generateExcelReport = async () => {
    setExporting(true);
    try {
      const workbook = new ExcelJS.Workbook();
      const odooViolet = '714B67';
      const odooGreen = '10B981';
      const darkSlate = '1E293B';
      const lavender = 'E9D5E5';

      // --- HOJA 1: RESUMEN EJECUTIVO ---
      const sheet1 = workbook.addWorksheet('Resumen Ejecutivo', { views: [{ showGridLines: false }] });
      sheet1.mergeCells('A1:H3');
      const banner = sheet1.getCell('A1');
      banner.value = 'REPORTE EJECUTIVO DE VENTAS — CADENA DE BOTICAS SAN JOSÉ';
      banner.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: darkSlate } };
      banner.font = { color: { argb: 'FFFFFF' }, size: 16, bold: true };
      banner.alignment = { vertical: 'middle', horizontal: 'center' };

      sheet1.mergeCells('A4:H4');
      const subBanner = sheet1.getCell('A4');
      subBanner.value = `Auditoría General | Periodo: Actual | Sedes: ${reportData.items.length} | Responsable: Auditoría Central`;
      subBanner.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: odooViolet } };
      subBanner.font = { color: { argb: 'FFFFFF' }, size: 9, bold: true };
      subBanner.alignment = { vertical: 'middle', horizontal: 'center' };

      const kpis = [
        { label: 'VENTA TOTAL', value: reportData.totalGlobal, color: odooGreen },
        { label: 'TICKET PROMEDIO', value: reportData.avgTicketGlobal, color: '6366F1' },
        { label: 'TRANSACCIONES', value: reportData.totalTicketsGlobal, color: 'F59E0B' },
        { label: 'SEDES ACTIVAS', value: reportData.items.filter(i => i.total > 0).length, color: '3B82F6' }
      ];

      kpis.forEach((kpi, idx) => {
        const col = idx * 2 + 1;
        sheet1.mergeCells(6, col, 6, col + 1);
        const lCell = sheet1.getCell(6, col);
        lCell.value = kpi.label;
        lCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kpi.color } };
        lCell.font = { color: { argb: 'FFFFFF' }, size: 9, bold: true };
        lCell.alignment = { horizontal: 'center' };

        sheet1.mergeCells(7, col, 8, col + 1);
        const vCell = sheet1.getCell(7, col);
        vCell.value = kpi.value;
        vCell.numFmt = idx < 2 ? '"S/ " #,##0.00' : '#,##0';
        vCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '000000' } };
        vCell.font = { color: { argb: kpi.color }, size: 14, bold: true };
        vCell.alignment = { vertical: 'middle', horizontal: 'center' };
      });

      sheet1.mergeCells('A11:H11');
      const tableHeader = sheet1.getCell('A11');
      tableHeader.value = 'DESEMPEÑO POR PUNTO DE VENTA';
      tableHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: darkSlate } };
      tableHeader.font = { color: { argb: 'FFFFFF' }, bold: true };
      tableHeader.alignment = { horizontal: 'center' };

      const headers = ['Sede', 'Transacciones', 'Total Venta (S/)', '% Part.', 'Ticket Prom. (S/)', 'Estado', 'Mejor Producto', 'Método Top'];
      const hRow = sheet1.getRow(12);
      headers.forEach((h, i) => {
        const cell = hRow.getCell(i + 1);
        cell.value = h;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: odooViolet } };
        cell.font = { color: { argb: 'FFFFFF' }, bold: true, size: 9 };
        cell.alignment = { horizontal: 'center' };
      });

      reportData.items.forEach((item, i) => {
        const row = sheet1.getRow(13 + i);
        row.getCell(1).value = item.name;
        row.getCell(2).value = item.tickets;
        row.getCell(3).value = item.total;
        row.getCell(3).numFmt = '"S/ " #,##0.00';
        row.getCell(4).value = reportData.totalGlobal > 0 ? item.total / reportData.totalGlobal : 0;
        row.getCell(4).numFmt = '0.0%';
        row.getCell(5).value = item.avgTicket;
        row.getCell(5).numFmt = '"S/ " #,##0.00';
        row.getCell(6).value = item.state.toUpperCase();
        row.getCell(7).value = item.topProducts[0]?.name || '-';
        row.getCell(8).value = Object.entries(item.payments).sort((a:any, b:any) => b[1] - a[1])[0]?.[0] || '-';
        if (i % 2 !== 0) row.eachCell(c => c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } });
      });

      sheet1.columns = [{ width: 25 }, { width: 14 }, { width: 18 }, { width: 12 }, { width: 18 }, { width: 12 }, { width: 25 }, { width: 15 }];

      // --- HOJA 4: PRODUCTOS (RANKING AVANZADO) ---
      const sheet4 = workbook.addWorksheet('Ranking Productos');
      sheet4.getCell('A1').value = 'TOP PRODUCTOS - RANKING ESTRATÉGICO';
      sheet4.getCell('A1').font = { bold: true, size: 14, color: { argb: odooViolet } };
      
      const pHeaders = ['Pos.', 'Descripción Producto', 'Unidades', 'Total (S/)', '% Part.', 'Ticket Med.', 'Mejor Sede'];
      const pRow = sheet4.getRow(3);
      pHeaders.forEach((h, i) => {
        const cell = pRow.getCell(i + 1);
        cell.value = h;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: odooViolet } };
        cell.font = { color: { argb: 'FFFFFF' }, bold: true };
      });

      const globalProdMap: Record<string, any> = {};
      rawLines.forEach(l => {
        const name = l.full_product_name || l.product_id[1];
        if (!globalProdMap[name]) globalProdMap[name] = { name, qty: 0, total: 0, tickets: 0 };
        globalProdMap[name].qty += l.qty;
        globalProdMap[name].total += l.price_subtotal_incl;
        globalProdMap[name].tickets++;
      });

      const prodRanking = Object.values(globalProdMap).sort((a, b) => b.total - a.total);
      prodRanking.slice(0, 50).forEach((p, i) => {
        const row = sheet4.getRow(4 + i);
        row.getCell(1).value = i + 1;
        row.getCell(2).value = p.name;
        row.getCell(3).value = p.qty;
        row.getCell(4).value = p.total;
        row.getCell(4).numFmt = '"S/ " #,##0.00';
        row.getCell(5).value = p.total / reportData.totalGlobal;
        row.getCell(5).numFmt = '0.0%';
        row.getCell(6).value = p.total / p.qty;
        row.getCell(6).numFmt = '"S/ " #,##0.00';
        
        // Estilos Top 3
        if (i === 0) row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD700' } }; // Oro
        if (i === 1) row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'C0C0C0' } }; // Plata
        if (i === 2) row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'CD7F32' } }; // Bronce
      });
      sheet4.columns = [{ width: 8 }, { width: 40 }, { width: 12 }, { width: 18 }, { width: 12 }, { width: 15 }, { width: 20 }];

      // --- HOJA 6: HORAS PICO ---
      const sheet6 = workbook.addWorksheet('Horas Pico');
      sheet6.getCell('A1').value = 'ANÁLISIS DE TRÁFICO POR HORA (BI)';
      sheet6.getCell('A1').font = { bold: true, size: 14 };

      const hourlySales: Record<number, { count: number, total: number }> = {};
      for (let h = 8; h <= 22; h++) hourlySales[h] = { count: 0, total: 0 };

      rawOrders.forEach(o => {
        const hour = new Date(o.date_order).getHours();
        if (hourlySales[hour]) {
          hourlySales[hour].count++;
          hourlySales[hour].total += o.amount_total;
        }
      });

      const hH = ['Hora', 'Tickets', 'Venta Bruta', '% Día'];
      const hHR = sheet6.getRow(3);
      hH.forEach((h, i) => {
        const cell = hHR.getCell(i + 1);
        cell.value = h;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: darkSlate } };
        cell.font = { color: { argb: 'FFFFFF' }, bold: true };
      });

      Object.entries(hourlySales).forEach(([h, d], idx) => {
        const row = sheet6.getRow(4 + idx);
        row.getCell(1).value = `${h}:00`;
        row.getCell(2).value = d.count;
        row.getCell(3).value = d.total;
        row.getCell(3).numFmt = '"S/ " #,##0.00';
        row.getCell(4).value = d.total / reportData.totalGlobal;
        row.getCell(4).numFmt = '0.0%';
      });

      // --- HOJA 7: DETALLE ---
      const sheet7 = workbook.addWorksheet('Detalle Transacciones');
      const detH = ['Fecha/Hora', 'Sede', 'Producto', 'Cant.', 'P. Unit.', 'Total'];
      const detR = sheet7.getRow(1);
      detH.forEach((h, i) => {
        const c = detR.getCell(i + 1);
        c.value = h;
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: odooViolet } };
        c.font = { color: { argb: 'FFFFFF' }, bold: true };
      });

      rawLines.slice(0, 5000).forEach((l, idx) => {
        const o = rawOrders.find(ord => ord.id === l.order_id[0]);
        const r = sheet7.getRow(idx + 2);
        r.getCell(1).value = o?.date_order || '-';
        r.getCell(2).value = o?.config_id[1] || '-';
        r.getCell(3).value = l.full_product_name || l.product_id[1];
        r.getCell(4).value = l.qty;
        r.getCell(5).value = l.price_unit;
        r.getCell(6).value = l.price_subtotal_incl;
        r.getCell(5).numFmt = '"S/ " #,##0.00';
        r.getCell(6).numFmt = '"S/ " #,##0.00';
        if (idx % 2 === 0) r.eachCell(c => c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F9FAFB' } });
      });
      sheet7.columns = [{ width: 20 }, { width: 20 }, { width: 45 }, { width: 10 }, { width: 15 }, { width: 15 }];

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `Reporte_BI_SanJose_${new Date().toISOString().split('T')[0]}.xlsx`);

    } catch (e) {
      console.error(e);
      alert("Error generando Excel. Revise la consola.");
    } finally {
      setExporting(false);
    }
  };

  const currentDetailData = selectedPos ? reportData.items.find(i => i.id === selectedPos.id) : null;

  return (
    <div className="max-w-[1400px] mx-auto space-y-8 pb-24 animate-fade">
      {/* Header BI */}
      <div className="bg-white p-8 border border-slate-200 rounded-[32px] shadow-sm flex flex-col md:flex-row justify-between items-center gap-8">
        <div className="flex items-center gap-6">
          <div className="p-4 bg-odoo-primary/10 rounded-2xl text-odoo-primary shadow-inner">
            <BarChart3 size={32}/>
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Intelligence Hub San José</h2>
            <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-[0.3em] flex items-center gap-2">
               Auditoría Estratégica en Tiempo Real
            </p>
          </div>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={generateExcelReport}
            disabled={exporting}
            className="o-btn o-btn-primary gap-4 py-4 px-10 shadow-2xl shadow-odoo-primary/20 hover:-translate-y-1 active:scale-95 transition-all disabled:opacity-50"
          >
            {exporting ? <Loader2 size={20} className="animate-spin" /> : <FileSpreadsheet size={20} />}
            <span className="text-xs uppercase font-black tracking-widest">Descargar Reporte Pro (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* KPIs Globales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-7 border border-slate-200 rounded-[32px] shadow-sm hover:border-odoo-primary/30 transition-all cursor-default group">
          <p className="text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest group-hover:text-odoo-primary">Venta Bruta Total</p>
          <div className="flex items-baseline gap-2">
            <h4 className="text-3xl font-black text-slate-800">S/ {reportData.totalGlobal.toLocaleString('es-PE', {minimumFractionDigits: 2})}</h4>
            <ArrowUpRight size={20} className="text-emerald-500" />
          </div>
        </div>
        <div className="bg-white p-7 border border-slate-200 rounded-[32px] shadow-sm hover:border-odoo-primary/30 transition-all">
          <p className="text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest">Ticket Promedio</p>
          <h4 className="text-3xl font-black text-odoo-primary">S/ {reportData.avgTicketGlobal.toLocaleString('es-PE', {minimumFractionDigits: 2})}</h4>
        </div>
        <div className="bg-white p-7 border border-slate-200 rounded-[32px] shadow-sm hover:border-odoo-primary/30 transition-all">
          <p className="text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest">Transacciones</p>
          <h4 className="text-3xl font-black text-slate-800">{reportData.totalTicketsGlobal} <span className="text-[10px] font-black opacity-30 tracking-widest">TICKETS</span></h4>
        </div>
        <div className="bg-white p-7 border border-slate-200 rounded-[32px] shadow-sm hover:border-odoo-primary/30 transition-all">
          <p className="text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest">Estado Cadena</p>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></div>
            <h4 className="text-3xl font-black text-slate-800 uppercase tracking-tighter">{reportData.items.filter(i => i.state === 'opened').length} EN LÍNEA</h4>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Tabla Principal */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-[40px] shadow-sm overflow-hidden flex flex-col">
           <div className="px-10 py-8 border-b bg-slate-50/50 flex justify-between items-center">
             <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-3">
               <Store size={18} className="text-odoo-primary"/> Monitor por Punto de Venta
             </h3>
             <span className="text-[10px] font-black text-slate-400 uppercase">Ordenado por facturación</span>
           </div>
           <div className="flex-1 overflow-x-auto">
             <table className="w-full text-left">
               <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase border-b">
                 <tr>
                   <th className="px-10 py-6">Punto de Venta</th>
                   <th className="px-10 py-6 text-center">Estado</th>
                   <th className="px-10 py-6 text-right">Participación</th>
                   <th className="px-10 py-6 text-right">Total Venta</th>
                   <th className="px-10 py-6 text-right w-16"></th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                 {reportData.items.map((item, idx) => (
                   <tr key={idx} className="hover:bg-slate-50/80 transition-colors group">
                     <td className="px-10 py-5">
                       <span className="text-xs font-black text-slate-700 uppercase tracking-tight">{item.name}</span>
                     </td>
                     <td className="px-10 py-5 text-center">
                       <span className={`text-[9px] font-black px-3 py-1 rounded-lg uppercase tracking-widest ${item.state === 'opened' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                         {item.state === 'opened' ? 'ABIERTA' : 'CERRADA'}
                       </span>
                     </td>
                     <td className="px-10 py-5 text-right">
                       <div className="flex flex-col items-end">
                         <span className="text-[10px] font-black text-slate-400 mb-1">
                           {reportData.totalGlobal > 0 ? ((item.total / reportData.totalGlobal) * 100).toFixed(1) : 0}%
                         </span>
                         <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                            <div className="h-full bg-odoo-primary/40 rounded-full transition-all duration-700" style={{ width: `${(item.total / reportData.totalGlobal) * 100}%` }}></div>
                         </div>
                       </div>
                     </td>
                     <td className="px-10 py-5 text-right font-black text-slate-800 text-sm">S/ {item.total.toLocaleString('es-PE', {minimumFractionDigits: 2})}</td>
                     <td className="px-10 py-5 text-right">
                       <button onClick={() => onSelect(item)} className="p-3 text-slate-300 hover:text-odoo-primary transition-all rounded-xl hover:bg-white shadow-sm border border-transparent hover:border-slate-100">
                         <ChevronRight size={22}/>
                       </button>
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
        </div>

        {/* Mix de Pagos */}
        <div className="bg-white border border-slate-200 rounded-[40px] shadow-sm p-10">
           <h3 className="text-xs font-black text-slate-500 uppercase mb-8 flex items-center gap-3 tracking-[0.2em]">
             <Wallet size={20} className="text-odoo-primary"/> Mix de Liquidez Global
           </h3>
           <div className="space-y-8">
             {(Object.entries(reportData.globalPayments) as [string, number][]).sort((a, b) => b[1] - a[1]).map(([method, amount], i) => (
               <div key={i} className="space-y-3">
                  <div className="flex justify-between items-center text-[11px] font-black uppercase tracking-tight">
                    <span className="text-slate-500">{method}</span>
                    <span className="text-slate-800">S/ {amount.toLocaleString('es-PE', {minimumFractionDigits: 2})}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden shadow-inner">
                    <div className="bg-odoo-primary h-full transition-all duration-1000 ease-out" style={{ width: `${(amount / reportData.totalGlobal) * 100}%` }}></div>
                  </div>
                  <p className="text-right text-[10px] font-bold text-slate-400 tracking-widest">
                    {((amount / reportData.totalGlobal) * 100).toFixed(1)}% del total recaudado
                  </p>
               </div>
             ))}
             {Object.keys(reportData.globalPayments).length === 0 && (
               <div className="py-24 text-center">
                 <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-200"><CreditCard size={40}/></div>
                 <p className="text-xs text-slate-400 font-bold uppercase tracking-widest italic opacity-50">Esperando transacciones...</p>
               </div>
             )}
           </div>
        </div>
      </div>

      {/* Modal Detalle */}
      {selectedPos && currentDetailData && (
        <div className="fixed inset-0 z-[600] flex justify-end animate-fade">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={onCloseDetail}></div>
          <div className="relative w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-500">
             <div className="px-10 py-10 border-b flex justify-between items-center bg-odoo-primary text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl"></div>
                <div className="flex items-center gap-6 z-10">
                   <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center shadow-inner">
                     <Store size={32}/>
                   </div>
                   <div>
                     <h3 className="text-2xl font-black uppercase tracking-tighter leading-none mb-2">{selectedPos.name}</h3>
                     <p className="text-[10px] opacity-60 font-bold uppercase tracking-[0.4em]">Auditoría Estratégica Individual</p>
                   </div>
                </div>
                <button onClick={onCloseDetail} className="w-12 h-12 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full transition-all active:scale-90 z-10"><X size={28}/></button>
             </div>
             
             <div className="flex-1 overflow-y-auto p-10 space-y-12 custom-scrollbar">
                <div className="grid grid-cols-2 gap-6">
                   <div className="bg-slate-50 p-8 rounded-[32px] border border-slate-100 shadow-sm">
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest">Facturación Hoy</p>
                      <p className="text-3xl font-black text-slate-800 tracking-tighter">S/ {currentDetailData.total.toLocaleString('es-PE', {minimumFractionDigits: 2})}</p>
                   </div>
                   <div className="bg-slate-50 p-8 rounded-[32px] border border-slate-100 shadow-sm">
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest">Ticket Promedio</p>
                      <p className="text-3xl font-black text-odoo-primary tracking-tighter">S/ {currentDetailData.avgTicket.toLocaleString('es-PE', {minimumFractionDigits: 2})}</p>
                   </div>
                </div>

                <div>
                   <h4 className="text-[11px] font-black text-slate-800 uppercase mb-6 flex items-center gap-3 tracking-[0.3em]">
                     <Wallet size={18} className="text-odoo-primary"/> Mix de Pagos Sede
                   </h4>
                   <div className="grid grid-cols-2 gap-4">
                     {Object.entries(currentDetailData.payments).map(([method, amount]: any, i) => (
                       <div key={i} className="p-6 border border-slate-100 rounded-2xl flex justify-between items-center bg-white shadow-sm group hover:border-odoo-primary/30 transition-all">
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-tight">{method}</span>
                          <span className="text-xs font-black text-slate-800 uppercase tracking-tight">S/ {amount.toLocaleString('es-PE', {minimumFractionDigits: 2})}</span>
                       </div>
                     ))}
                   </div>
                </div>

                <div>
                   <h4 className="text-[11px] font-black text-slate-800 uppercase mb-6 flex items-center gap-3 tracking-[0.3em]">
                     <ShoppingBag size={18} className="text-odoo-primary"/> Ranking de Artículos (Top Sede)
                   </h4>
                   <div className="border border-slate-100 rounded-[32px] overflow-hidden shadow-sm bg-white">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase border-b">
                           <tr>
                             <th className="px-8 py-5">Descripción</th>
                             <th className="px-8 py-5 text-right">Cant.</th>
                             <th className="px-8 py-5 text-right">Total</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                           {currentDetailData.topProducts.map((p: any, i: number) => (
                             <tr key={i} className="text-xs group hover:bg-slate-50 transition-colors">
                               <td className="px-8 py-4 font-black text-slate-700 uppercase leading-none group-hover:text-odoo-primary">{p.name}</td>
                               <td className="px-8 py-4 text-right font-black text-slate-400">{p.qty} <span className="text-[9px] opacity-40 uppercase">Und</span></td>
                               <td className="px-8 py-4 text-right font-black text-slate-800">S/ {p.total.toLocaleString('es-PE', {minimumFractionDigits: 2})}</td>
                             </tr>
                           ))}
                        </tbody>
                      </table>
                   </div>
                </div>
             </div>
             
             <div className="p-10 border-t bg-slate-50">
                <button onClick={onCloseDetail} className="w-full bg-slate-900 text-white py-6 rounded-2xl font-black uppercase tracking-[0.3em] text-[11px] shadow-xl hover:bg-black transition-all active:scale-95">Finalizar Auditoría Sede</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};
