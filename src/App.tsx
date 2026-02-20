
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  LogOut, RefreshCw, User as UserIcon, Loader2, 
  LayoutDashboard, Truck, TrendingUp, AlertTriangle, Calendar, DollarSign, 
  Settings, Grid, Bell, HelpCircle, Package, Store, Clock, UserCheck,
  ExternalLink, ChevronRight, Menu, X, ShieldCheck, Zap, Users, Send
} from 'lucide-react';
import { OdooClient } from './services/odooService';
import { AppConfig, Product, Warehouse, Employee } from './types';

import { Dashboard } from './components/Dashboard';
import { AuditModule } from './components/AuditModule';
import { OrderModule } from './components/OrderModule';
import { SessionModule } from './components/SessionModule';
import { StaffManagement } from './components/StaffManagement';
import { ReportesModule } from './components/ReportesModule';

const DEFAULT_CONFIG: AppConfig = {
  url: "https://mitienda.facturaclic.pe",
  db: "mitienda_base_ac",
  user: "soporte@facturaclic.pe",
  apiKey: "7259747d6d717234ee64087c9bd4206b99fa67a1",
  companyName: "CADENA DE BOTICAS SAN JOSE S.A.C."
};

const ADMIN_EMAILS = ['soporte@facturaclic.pe', 'admin1@sanjose.pe'];
const SUPER_USER_EMAIL = 'soporte@facturaclic.pe';
const EXCLUDED_EMPLOYEE_NAMES = ['YULI', 'DEMO', '3E', 'PROBANDO', 'TEST', 'USUARIO'];

const App: React.FC = () => {
  const getPeruDateString = () => {
    const date = new Date();
    const peruDate = new Date(date.getTime() - (5 * 60 * 60 * 1000));
    return peruDate.toISOString().split('T')[0];
  };

  const [config] = useState<AppConfig>(() => {
    const saved = localStorage.getItem('odoo_ops_pro_config');
    return saved ? JSON.parse(saved) : DEFAULT_CONFIG;
  });

  const [session, setSession] = useState<any | null>(() => {
    const saved = localStorage.getItem('sjs_ops_session');
    return saved ? JSON.parse(saved) : null;
  });

  const isAdmin = useMemo(() => {
    if (!session || !session.login) return false;
    return ADMIN_EMAILS.includes(session.login.toLowerCase());
  }, [session]);

  const isSuperUser = useMemo(() => {
    if (!session || !session.login) return false;
    return session.login.toLowerCase() === SUPER_USER_EMAIL.toLowerCase();
  }, [session]);

  const [view, setView] = useState<'login' | 'app'>(session ? 'app' : 'login');
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    if (session) {
      const isUserAdmin = ADMIN_EMAILS.includes(session.login?.toLowerCase());
      setActiveTab(isUserAdmin ? 'dashboard' : 'pedidos');
    }
  }, [session]);

  const [loading, setLoading] = useState(false);
  const [lastSync, setLastSync] = useState("");
  const [errorLog, setErrorLog] = useState<string | null>(null);
  const [loginInput, setLoginInput] = useState("");
  
  const [posConfigs, setPosConfigs] = useState<any[]>([]);
  const [posSalesData, setPosSalesData] = useState<any>({});
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [dateRange, setDateRange] = useState({ 
    start: getPeruDateString(), 
    end: getPeruDateString() 
  });
  
  const [rawOrders, setRawOrders] = useState<any[]>([]);
  const [rawLines, setRawLines] = useState<any[]>([]);
  const [rawPayments, setRawPayments] = useState<any[]>([]);

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [originWarehouseId, setOriginWarehouseId] = useState<number | null>(null);
  const [originLocationId, setOriginLocationId] = useState<number | null>(null);
  const [internalPickingTypeId, setInternalPickingTypeId] = useState<number | null>(null);
  const [currentCompanyId, setCurrentCompanyId] = useState<number | null>(null);
  
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [cart, setCart] = useState<any[]>([]);
  const [targetWarehouseId, setTargetWarehouseId] = useState<number | null>(null);

  const client = useMemo(() => new OdooClient(config.url, config.db), [config.url, config.db]);

  const fetchData = useCallback(async () => {
    if (view !== 'app') return;
    setLoading(true);
    setErrorLog(null);
    try {
      if (!client.isAuthenticated()) {
        const uid = await client.authenticate(config.user, config.apiKey);
        if (!uid) throw new Error("Sesión expirada.");
      }

      const companies = await client.searchRead('res.company', [['name', 'ilike', 'SAN JOSE']], ['id']);
      if (!companies || !companies.length) throw new Error("Compañía no encontrada.");
      const sanJoseId = companies[0].id;
      setCurrentCompanyId(sanJoseId);

      const ws = await client.searchRead('stock.warehouse', [['company_id', '=', sanJoseId]], ['name', 'id', 'code', 'lot_stock_id']);
      setWarehouses(ws || []);
      
      const principal = (ws || []).find((w: any) => 
        w.code === 'PR' || w.code === 'PRINCIPAL1' || w.name.toUpperCase().includes('PRINCIPAL')
      );
      
      if (principal) {
        setOriginWarehouseId(principal.id);
        if (principal.lot_stock_id) setOriginLocationId(principal.lot_stock_id[0]);

        const pickingTypes = await client.searchRead('stock.picking.type', [
          ['warehouse_id', '=', principal.id],
          ['code', '=', 'internal']
        ], ['id', 'name']);
        
        if (pickingTypes && pickingTypes.length > 0) {
          setInternalPickingTypeId(pickingTypes[0].id);
        }
      }

      const empData = await client.searchRead('hr.employee', [['active', '=', true]], ['id', 'name', 'job_title', 'work_email', 'work_phone', 'department_id', 'image_128']) || [];
      const filteredEmps = empData.filter((emp: any) => {
        const nameUpper = emp.name.toUpperCase();
        const trimmedName = emp.name.trim();
        const isExcluded = EXCLUDED_EMPLOYEE_NAMES.some(term => nameUpper.includes(term));
        const isTooShort = trimmedName.length <= 2;
        return !isExcluded && !isTooShort;
      });
      setEmployees(filteredEmps);

      if (isAdmin) {
        const configs = await client.searchRead('pos.config', [['company_id', '=', sanJoseId]], ['name', 'id']) || [];
        const blacklist = ['CRUZ', 'CHALPON', 'INDACOCHEA', 'AMAY', 'P&P', 'P & P'];
        const filteredConfigs = configs.filter((c: any) => !blacklist.some(term => c.name.toUpperCase().includes(term)));
        setPosConfigs(filteredConfigs);

        const configIds = filteredConfigs.map(c => c.id);
        const openSessions = await client.searchRead('pos.session', [['state', '=', 'opened'], ['config_id', 'in', configIds]], ['id', 'name', 'user_id', 'start_at', 'config_id']) || [];
        setActiveSessions(openSessions);

        const ordersDomain = [
          ['company_id', '=', sanJoseId],
          ['date_order', '>=', `${dateRange.start} 00:00:00`],
          ['date_order', '<=', `${dateRange.end} 23:59:59`],
          ['state', 'in', ['paid', 'done', 'invoiced']]
        ];
        const orders = await client.searchRead('pos.order', ordersDomain, ['id', 'amount_total', 'config_id', 'session_id', 'lines', 'payment_ids', 'date_order']) || [];
        setRawOrders(orders);
        
        const orderIds = orders.map(o => o.id);
        let allLines: any[] = [];
        let allPayments: any[] = [];
        if (orderIds.length > 0) {
          allLines = await client.searchRead('pos.order.line', [['order_id', 'in', orderIds]], ['order_id', 'product_id', 'qty', 'price_subtotal_incl', 'price_unit', 'full_product_name']) || [];
          allPayments = await client.searchRead('pos.payment', [['pos_order_id', 'in', orderIds]], ['pos_order_id', 'payment_method_id', 'amount']) || [];
        }
        setRawLines(allLines);
        setRawPayments(allPayments);

        const stats: any = {};
        filteredConfigs.forEach(conf => {
          const posOrders = orders.filter(o => o.config_id && o.config_id[0] === conf.id);
          const posOrderIds = posOrders.map(o => o.id);
          const posLines = allLines.filter(l => posOrderIds.includes(l.order_id[0]));
          const posPayments = allPayments.filter(p => posOrderIds.includes(p.pos_order_id[0]));
          const hasOpenSession = openSessions.some((s: any) => s.config_id && s.config_id[0] === conf.id);

          const productMap: Record<string, any> = {};
          posLines.forEach(l => {
            const pId = l.product_id[0];
            if (!productMap[pId]) productMap[pId] = { name: l.product_id[1], qty: 0, total: 0 };
            productMap[pId].qty += l.qty;
            productMap[pId].total += l.price_subtotal_incl;
          });

          const paymentMap: Record<string, number> = {};
          posPayments.forEach(p => {
            const mName = p.payment_method_id[1];
            paymentMap[mName] = (paymentMap[mName] || 0) + p.amount;
          });

          stats[conf.id] = {
            isOnline: hasOpenSession,
            totalSales: posOrders.reduce((acc, curr) => acc + (curr.amount_total || 0), 0),
            count: posOrders.length,
            topProducts: Object.values(productMap).sort((a: any, b: any) => b.qty - a.qty).slice(0, 10),
            payments: paymentMap
          };
        });
        setPosSalesData(stats);
      }
      setLastSync(new Date().toLocaleTimeString('es-PE'));
    } catch (e: any) { setErrorLog(e.message); } finally { setLoading(false); }
  }, [client, view, dateRange, config, isAdmin]);

  useEffect(() => { if (view === 'app') fetchData(); }, [view, fetchData]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorLog(null);
    try {
      const uid = await client.authenticate(config.user, config.apiKey);
      if (!uid) throw new Error("Credenciales maestros inválidas.");
      const user = await client.searchRead('res.users', [['login', '=', loginInput.trim()]], ['name', 'login'], { limit: 1 });
      if (!user || !user.length) throw new Error("ID de Usuario no encontrado.");
      const sessionData = { name: user[0].name, login: user[0].login };
      localStorage.setItem('sjs_ops_session', JSON.stringify(sessionData));
      setSession(sessionData);
      setView('app');
    } catch (e: any) { setErrorLog(e.message); } finally { setLoading(false); }
  };

  const handleLogout = () => {
    localStorage.removeItem('sjs_ops_session');
    setSession(null);
    setView('login');
  };

  const handleProductSearch = async (term: string) => {
    if (term.length < 3 || !currentCompanyId) return;
    setLoading(true);
    try {
      const results = await client.searchRead('product.product', [
        ['active', '=', true],
        ['company_id', 'in', [currentCompanyId, false]],
        '|', ['name', 'ilike', term], ['default_code', 'ilike', term]
      ], ['id', 'name', 'default_code', 'qty_available', 'list_price'], { 
        context: originLocationId ? { location: originLocationId } : {}, 
        limit: 20 
      });
      setProducts(results || []);
    } catch (e: any) { console.error(e); } finally { setLoading(false); }
  };

  const handleSubmitOrder = async () => {
    if (!targetWarehouseId || cart.length === 0 || !internalPickingTypeId || !currentCompanyId) {
      alert("Error: Faltan parámetros de configuración de Odoo (Picking Type o Company).");
      return;
    }
    setLoading(true);
    try {
      const targetWarehouse = warehouses.find(w => w.id === targetWarehouseId);
      if (!targetWarehouse) throw new Error("Botica destino no válida.");
      
      const pickingId = await client.create('stock.picking', {
        picking_type_id: internalPickingTypeId,
        location_id: originLocationId,
        location_dest_id: targetWarehouse.lot_stock_id?.[0],
        company_id: currentCompanyId,
        origin: `SOLICITUD APP OPS - SOLICITADO POR: ${session?.name || 'Usuario SJ'}`,
        move_ids_without_package: cart.map(item => [0, 0, { 
          name: item.name, 
          product_id: item.id, 
          product_uom_qty: item.qty, 
          product_uom: 1, 
          location_id: originLocationId, 
          location_dest_id: targetWarehouse.lot_stock_id?.[0],
          company_id: currentCompanyId
        }])
      });
      
      if (pickingId) { 
        alert(`¡ÉXITO! Se ha generado la Solicitud #${pickingId} en el almacén PRINCIPAL1.`); 
        setCart([]); 
        setTargetWarehouseId(null); 
      }
    } catch (e: any) { 
      alert(`Error al generar pedido en Odoo: ${e.message}`); 
    } finally { 
      setLoading(false); 
    }
  };

  if (view === 'login') {
    return (
      <div className="min-h-screen relative flex items-center justify-center p-4 bg-[#f8fafc] overflow-hidden font-sans">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#714B67 1px, transparent 0)', backgroundSize: '40px 40px' }}></div>
        <div className="w-full max-w-[420px] z-10 animate-fade space-y-8">
          <div className="text-center space-y-4">
            <div className="inline-flex p-4 bg-white rounded-[32px] shadow-[0_20px_50px_-12px_rgba(113,75,103,0.15)] mb-4 animate-bounce-slow border border-odoo-primary/5">
               <div className="w-16 h-16 bg-gradient-to-br from-odoo-primary to-[#8b5e7e] rounded-2xl flex items-center justify-center text-white text-3xl font-black italic shadow-inner">SJ</div>
            </div>
            <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tighter">BOTICAS <span className="text-odoo-primary">SAN JOSE</span></h1>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.4em]">CENTRO DE OPERACIONES</p>
          </div>
          <div className="bg-white/80 backdrop-blur-xl p-10 rounded-[40px] border border-white shadow-[0_30px_60px_-15px_rgba(0,0,0,0.05)] space-y-8">
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Autenticación Odoo</label>
                <div className="relative group">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-odoo-primary" size={18}/>
                  <input type="text" className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-12 pr-4 py-4 text-slate-700 text-sm outline-none focus:bg-white transition-all" placeholder="ej: admin1@sanjose.pe" value={loginInput} onChange={e => setLoginInput(e.target.value)} required />
                </div>
              </div>
              <button disabled={loading} className="w-full bg-odoo-primary text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all hover:-translate-y-1 flex items-center justify-center gap-3">
                {loading ? <Loader2 className="animate-spin" size={20}/> : "Acceder al Sistema"}
              </button>
            </form>
            {errorLog && <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-500 text-[10px] font-bold uppercase tracking-wide"><AlertTriangle size={16}/> {errorLog}</div>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc] font-sans">
      <header className="sticky top-0 h-14 bg-white/90 backdrop-blur-md text-slate-800 flex items-center justify-between px-6 shrink-0 z-[100] border-b border-slate-200">
        <div className="flex items-center h-full">
          <div className="w-9 h-9 bg-odoo-primary rounded-xl flex items-center justify-center text-white text-[10px] font-black italic mr-3">SJ</div>
          <div className="flex flex-col">
            <span className="text-sm font-black text-slate-800 leading-none uppercase tracking-tighter">BOTICAS SAN JOSE</span>
          </div>
        </div>
        <div className="flex items-center gap-3 h-full">
           <button onClick={handleLogout} className="w-10 h-10 flex items-center justify-center bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500 rounded-xl transition-all border border-slate-100"><LogOut size={18}/></button>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row relative">
        <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] py-8 z-50">
          <div className="flex-1 space-y-1 overflow-y-auto custom-scrollbar px-4">
             {isAdmin && (
               <>
                 <button onClick={() => setActiveTab('dashboard')} className={`o-sidebar-item w-full text-left ${activeTab === 'dashboard' ? 'active' : ''}`}><LayoutDashboard size={18} /> Resumen Ejecutivo</button>
                 <button onClick={() => setActiveTab('sesiones')} className={`o-sidebar-item w-full text-left ${activeTab === 'sesiones' ? 'active' : ''}`}><Clock size={18} /> Control Sesiones</button>
                 <button onClick={() => setActiveTab('ventas')} className={`o-sidebar-item w-full text-left ${activeTab === 'ventas' ? 'active' : ''}`}><TrendingUp size={18} /> Auditoría Puntos</button>
                 {isSuperUser && (
                   <button onClick={() => setActiveTab('reportes')} className={`o-sidebar-item w-full text-left ${activeTab === 'reportes' ? 'active' : ''}`}><Send size={18} /> Reportes Automáticos</button>
                 )}
                 <button onClick={() => setActiveTab('personal')} className={`o-sidebar-item w-full text-left ${activeTab === 'personal' ? 'active' : ''}`}><Users size={18} /> Personal y Horarios</button>
                 <div className="px-4 mt-8 mb-4 border-t pt-8">
                    <div className="space-y-2">
                      <input type="date" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-[11px] font-bold text-slate-600 outline-none"/>
                      <input type="date" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-[11px] font-bold text-slate-600 outline-none"/>
                    </div>
                    <button onClick={fetchData} className="w-full bg-slate-900 text-white text-[10px] font-black py-3 rounded-xl uppercase mt-4 flex items-center justify-center gap-2 tracking-widest"><RefreshCw size={14} className={loading ? 'animate-spin' : ''}/> Sincronizar Odoo</button>
                 </div>
               </>
             )}
             <button onClick={() => setActiveTab('pedidos')} className={`o-sidebar-item w-full text-left ${activeTab === 'pedidos' ? 'active' : ''}`}><Truck size={18} /> Logística Interna</button>
          </div>
        </aside>

        <main className="flex-1 p-4 md:p-10 bg-slate-50 pb-24 md:pb-10">
          {activeTab === 'dashboard' && isAdmin && <Dashboard posConfigs={posConfigs} posSalesData={posSalesData} lastSync={lastSync} />}
          {activeTab === 'sesiones' && isAdmin && <SessionModule activeSessions={activeSessions} loading={loading} />}
          {activeTab === 'ventas' && isAdmin && (
            <AuditModule 
              posConfigs={posConfigs} 
              posSalesData={posSalesData} 
              rawOrders={rawOrders}
              rawLines={rawLines}
              rawPayments={rawPayments}
              onSelect={(pos) => setPosSalesData((prev:any) => ({...prev, _selected: pos}))} 
              selectedPos={posSalesData._selected} 
              onCloseDetail={() => setPosSalesData((prev:any) => ({...prev, _selected: null}))} 
            />
          )}
          {activeTab === 'reportes' && isSuperUser && <ReportesModule />}
          {activeTab === 'personal' && <StaffManagement isAdmin={isAdmin} employees={employees} posConfigs={posConfigs} currentUserEmail={session?.login} loading={loading} />}
          {activeTab === 'pedidos' && <OrderModule productSearch={productSearch} setProductSearch={setProductSearch} onSearch={handleProductSearch} products={products} cart={cart} setCart={setCart} warehouses={warehouses.filter(w => w.id !== originWarehouseId)} targetWarehouseId={targetWarehouseId} setTargetWarehouseId={setTargetWarehouseId} onSubmitOrder={handleSubmitOrder} loading={loading} />}
        </main>
      </div>

      {loading && <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[300] bg-white border px-6 py-3 rounded-full shadow-2xl flex items-center gap-4 animate-fade"><Loader2 size={18} className="text-odoo-primary animate-spin" /><p className="text-[10px] font-black text-slate-700 uppercase tracking-[0.2em]">Cargando Datos Odoo...</p></div>}
    </div>
  );
};

export default App;
