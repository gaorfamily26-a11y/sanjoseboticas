
import React, { useEffect, useState } from 'react';
import { reportService } from '../services/supabaseService';
import { 
  Calendar, Store, CheckCircle2, Clock, Wallet, ShoppingBag, 
  Loader2, RefreshCw, Send, Info, Copy, Check, Terminal, Zap,
  Settings2, BellRing, AlertCircle, ArrowRight,
  Database, MessageSquare, ShieldAlert, Code2, Sparkles, Bug
} from 'lucide-react';

export const ReportesModule: React.FC = () => {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGuide, setShowGuide] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [copied, setCopied] = useState(false);
  const [scheduledHour, setScheduledHour] = useState('23');
  const [savingConfig, setSavingConfig] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [reportsData, configHour] = await Promise.all([
        reportService.getDailyClosings(),
        reportService.getReportConfig()
      ]);
      setReports(reportsData || []);
      setScheduledHour(configHour);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleUpdateHour = async (newHour: string) => {
    setSavingConfig(true);
    try {
      await reportService.updateReportConfig(newHour);
      setScheduledHour(newHour);
      setShowConfig(false);
    } catch (e) {
      alert("Error al guardar configuración");
    } finally {
      setSavingConfig(false);
    }
  };

  const copyTestJson = () => {
    const testJson = {
      pos_id: 101,
      pos_nombre: "BOTICA SJ - TEST",
      total_monto: 1250.50,
      conteo_tickets: 45,
      fecha: new Date().toISOString().split('T')[0]
    };
    navigator.clipboard.writeText(JSON.stringify(testJson, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatHour = (h: string) => {
    const hour = parseInt(h);
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:00 ${suffix}`;
  };

  const odooFormula = `[["date_order", ">=", "{{ $now.minus({ hours: 5 }).format('yyyy-MM-dd') }} 00:00:00"], ["date_order", "<=", "{{ $now.minus({ hours: 5 }).format('yyyy-MM-dd') }} 23:59:59"], ["state", "in", ["paid", "done", "invoiced"]]]`;

  return (
    <div className="max-w-[1400px] mx-auto space-y-8 animate-fade pb-24">
      {/* Header */}
      <div className="bg-white p-10 border border-slate-200 rounded-[40px] shadow-sm flex flex-col md:row justify-between items-center gap-8">
        <div className="flex items-center gap-6">
          <div className="p-4 bg-odoo-primary/10 rounded-3xl text-odoo-primary">
            <Send size={32}/>
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter leading-none">Reportes Automáticos SJ</h2>
            <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-[0.3em]">Programado: {formatHour(scheduledHour)}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          <button onClick={() => setShowConfig(!showConfig)} className="o-btn bg-slate-100 text-slate-600 gap-2"><Settings2 size={18}/> Ajustes</button>
          <button onClick={() => setShowGuide(!showGuide)} className="o-btn bg-slate-800 text-white gap-2"><Bug size={18}/> Error 400</button>
          <button onClick={loadData} className="o-btn o-btn-primary gap-2"><RefreshCw size={18} className={loading ? 'animate-spin' : ''}/> Sincronizar</button>
        </div>
      </div>

      {/* Alerta de Error */}
      {!loading && reports.length === 0 && (
        <div className="bg-red-50 border-2 border-red-200 rounded-[40px] p-10 animate-fade">
           <div className="flex flex-col lg:flex-row gap-8 items-center">
              <div className="p-6 bg-red-100 text-red-500 rounded-full"><AlertCircle size={48} /></div>
              <div className="flex-1 text-center lg:text-left">
                 <h3 className="text-xl font-black text-red-900 uppercase">Error Detectado en n8n</h3>
                 <p className="text-sm text-red-700 font-medium">Odoo rechazó la consulta (Error 400). Asegúrate de usar Doble Corchete en el campo Args de n8n.</p>
              </div>
              <button onClick={() => setShowGuide(true)} className="bg-red-600 text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest">Ver Solución</button>
           </div>
        </div>
      )}

      {/* Guía de Reparación */}
      {showGuide && (
        <div className="bg-slate-900 rounded-[40px] p-10 border border-slate-700 shadow-2xl animate-fade">
           <h3 className="text-sm font-black text-emerald-400 uppercase tracking-widest mb-6 flex items-center gap-2"><Terminal size={20}/> Fórmula Maestra (Copia Exacta)</h3>
           <div className="bg-black/50 p-6 rounded-2xl border border-slate-700 mb-8">
              <code className="text-emerald-400 text-xs font-mono break-all leading-relaxed block select-all">
                {odooFormula}
              </code>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
                 <p className="text-[10px] font-black text-white uppercase mb-2">Paso 1: Args en n8n</p>
                 <p className="text-xs text-slate-400">Pega la fórmula anterior asegurándote de que no haya corchetes triples al inicio.</p>
              </div>
              <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
                 <p className="text-[10px] font-black text-white uppercase mb-2">Paso 2: Sincronizar</p>
                 <p className="text-xs text-slate-400">Dale a "Execute step" en n8n y luego a "Sincronizar" en este panel.</p>
              </div>
           </div>
        </div>
      )}

      {/* Ajustes de Hora */}
      {showConfig && (
        <div className="bg-white border-4 border-odoo-primary/10 rounded-[40px] p-10 shadow-xl animate-fade">
           <h3 className="text-xs font-black text-slate-800 uppercase tracking-[0.2em] mb-6">Programar Hora de Cierre</h3>
           <div className="flex flex-wrap gap-2">
              {Array.from({ length: 24 }).map((_, h) => (
                <button key={h} disabled={savingConfig} onClick={() => handleUpdateHour(h.toString())} className={`px-4 py-3 rounded-xl text-[10px] font-black uppercase transition-all border ${scheduledHour === h.toString() ? 'bg-odoo-primary text-white' : 'bg-slate-50 text-slate-400'}`}>
                   {h % 12 || 12} {h >= 12 ? 'PM' : 'AM'}
                </button>
              ))}
           </div>
        </div>
      )}

      {/* Listado de Reportes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {loading ? (
          <div className="col-span-full py-24 text-center">
            <Loader2 className="animate-spin mx-auto text-odoo-primary mb-4" size={48}/>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sincronizando con la nube...</p>
          </div>
        ) : reports.length === 0 ? (
          <div className="col-span-full py-32 text-center bg-white border border-dashed border-slate-200 rounded-[40px] opacity-40">
             <p className="text-xs font-black text-slate-400 uppercase">Sin datos disponibles. Corrige el flujo de n8n para empezar.</p>
          </div>
        ) : reports.map((rpt) => (
          <div key={rpt.id} className="bg-white border border-slate-200 rounded-[40px] overflow-hidden shadow-sm hover:shadow-xl transition-all group">
            <div className="px-8 py-5 border-b bg-slate-50 flex justify-between items-center group-hover:bg-odoo-primary/5">
              <div className="flex items-center gap-3">
                <Calendar size={14} className="text-odoo-primary"/>
                <span className="text-[11px] font-black text-slate-500 uppercase">{new Date(rpt.fecha).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
              </div>
              <div className={`px-3 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest flex items-center gap-2 ${rpt.enviado_whatsapp ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                {rpt.enviado_whatsapp ? 'Enviado WS' : 'En Espera'}
              </div>
            </div>
            <div className="p-8 space-y-6">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 bg-odoo-primary/10 rounded-2xl flex items-center justify-center text-odoo-primary font-black text-xl">{rpt.pos_nombre.charAt(0)}</div>
                <div>
                  <h4 className="text-sm font-black text-slate-800 uppercase leading-none mb-2">{rpt.pos_nombre}</h4>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Sede ID: {rpt.pos_id}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Venta Total</p>
                    <p className="text-lg font-black text-slate-800">S/ {rpt.total_monto.toLocaleString('es-PE', {minimumFractionDigits: 2})}</p>
                 </div>
                 <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Operaciones</p>
                    <p className="text-lg font-black text-slate-800">{rpt.conteo_tickets}</p>
                 </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
