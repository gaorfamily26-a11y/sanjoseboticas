
import React from 'react';
import { Truck, Search, Plus, Trash2, ShoppingCart, Package, CheckCircle2, Loader2, AlertCircle, List, Info } from 'lucide-react';

interface OrderModuleProps {
  productSearch: string;
  setProductSearch: (val: string) => void;
  onSearch: (term: string) => void;
  products: any[];
  cart: any[];
  setCart: (cart: any[]) => void;
  warehouses: any[];
  targetWarehouseId: number | null;
  setTargetWarehouseId: (id: number) => void;
  onSubmitOrder: () => void;
  loading: boolean;
}

export const OrderModule: React.FC<OrderModuleProps> = ({ 
  productSearch, setProductSearch, onSearch, products, cart, setCart, 
  warehouses, targetWarehouseId, setTargetWarehouseId, onSubmitOrder, loading 
}) => {
  return (
    <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade pb-12">
       {/* Left Side: Product Search */}
       <div className="lg:col-span-8 space-y-6">
          <div className="bg-white border border-odoo-border rounded shadow-sm overflow-hidden">
             <div className="px-6 py-4 border-b bg-gray-50 flex justify-between items-center">
                <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2 uppercase tracking-tight">
                  <Truck size={18} className="text-odoo-primary"/> Suministro: Almacén Principal (PRINCIPAL1)
                </h3>
                <div className="flex items-center gap-2">
                   <span className="text-[10px] font-bold text-white bg-odoo-primary px-2 py-1 rounded">STOCK ORIGEN</span>
                </div>
             </div>
             <div className="p-6 space-y-6">
                <div className="bg-blue-50 border border-blue-100 p-3 rounded flex items-start gap-3">
                   <Info size={16} className="text-blue-500 mt-0.5 shrink-0" />
                   <p className="text-[11px] text-blue-700 font-medium">
                     El stock mostrado a continuación corresponde únicamente a la disponibilidad física en el <b>Almacén Principal (PRINCIPAL1)</b>.
                   </p>
                </div>

                <div className="relative group">
                   <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-odoo-primary transition-colors" size={18}/>
                   <input 
                    type="text" 
                    placeholder="Buscar producto en PRINCIPAL1..." 
                    value={productSearch} 
                    onChange={e => { setProductSearch(e.target.value); onSearch(e.target.value); }} 
                    className="w-full pl-12 pr-4 py-3 o-input" 
                   />
                </div>

                <div className="border border-odoo-border rounded overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 text-[11px] font-black text-gray-400 uppercase border-b border-odoo-border">
                       <tr>
                         <th className="px-4 py-2">Producto</th>
                         <th className="px-4 py-2 text-right">Stock Disp. (P1)</th>
                         <th className="px-4 py-2 text-center w-20">Acción</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                       {products.length === 0 ? (
                         <tr>
                            <td colSpan={3} className="px-4 py-12 text-center text-gray-400 italic text-xs">
                               {productSearch.length > 0 ? 'No se encontraron resultados en PRINCIPAL1' : 'Inicie una búsqueda de productos'}
                            </td>
                         </tr>
                       ) : products.map(p => (
                         <tr key={p.id} className="hover:bg-gray-50 transition-colors group">
                            <td className="px-4 py-3">
                               <div className="flex flex-col">
                                  <span className="text-xs font-bold text-gray-700 uppercase">{p.name}</span>
                                  <span className="text-[10px] font-medium text-gray-400">Ref: {p.default_code || 'S/N'}</span>
                               </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                               <span className={`text-xs font-bold ${p.qty_available > 10 ? 'text-green-600' : 'text-amber-600'}`}>
                                  {p.qty_available} UND
                               </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                               <button 
                                onClick={() => setCart([...cart, {...p, qty: 1}])} 
                                className="o-btn o-btn-secondary p-1.5 rounded-full hover:bg-odoo-primary hover:text-white transition-all"
                               >
                                  <Plus size={16}/>
                               </button>
                            </td>
                         </tr>
                       ))}
                    </tbody>
                  </table>
                </div>
             </div>
          </div>
       </div>

       {/* Right Side: Cart / Order */}
       <div className="lg:col-span-4 space-y-6">
          <div className="bg-white border border-odoo-border rounded shadow-sm flex flex-col h-[calc(100vh-160px)] overflow-hidden">
             <div className="px-6 py-4 border-b bg-odoo-primary text-white flex justify-between items-center">
                <h3 className="text-sm font-bold uppercase flex items-center gap-2"><ShoppingCart size={18}/> Mi Solicitud</h3>
                <span className="text-[10px] font-black bg-white/20 px-2 py-0.5 rounded">{cart.length} Items</span>
             </div>
             
             <div className="p-5 border-b bg-gray-50/30 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <List size={14} className="text-odoo-primary" /> Botica Solicitante
                  </label>
                  <select 
                    value={targetWarehouseId || ''} 
                    onChange={e => setTargetWarehouseId(Number(e.target.value))} 
                    className="w-full o-input bg-white font-bold"
                  >
                     <option value="">Seleccione destino...</option>
                     {warehouses.map(w => (
                       <option key={w.id} value={w.id}>{w.name}</option>
                     ))}
                  </select>
                </div>
             </div>

             <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar bg-gray-50/10">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center opacity-20">
                     <Package size={48} className="text-gray-400 mb-4"/>
                     <p className="text-[11px] font-black uppercase text-center">Lista de envío vacía</p>
                  </div>
                ) : cart.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-white border border-odoo-border rounded shadow-sm animate-fade">
                     <div className="flex-1 min-w-0 pr-4">
                        <p className="text-[11px] font-bold text-gray-700 uppercase truncate leading-tight">{item.name}</p>
                        <p className="text-[9px] text-gray-400 font-medium mt-1">Disp: {item.qty_available} | Ref: {item.default_code || '-'}</p>
                     </div>
                     <div className="flex items-center gap-2">
                        <input 
                          type="number" 
                          min="1" 
                          value={item.qty} 
                          onChange={e => setCart(cart.map((c, i) => i === idx ? {...c, qty: Number(e.target.value)} : c))} 
                          className="w-10 o-input p-1 text-center text-xs font-bold"
                        />
                        <button onClick={() => setCart(cart.filter((_, i) => i !== idx))} className="text-gray-300 hover:text-red-500 transition-colors">
                          <Trash2 size={16}/>
                        </button>
                     </div>
                  </div>
                ))}
             </div>

             <div className="p-6 border-t bg-gray-50 space-y-4">
                <div className="flex justify-between items-center">
                   <span className="text-xs font-bold text-gray-500 uppercase">Total Unidades</span>
                   <span className="text-xl font-bold text-odoo-primary">
                    {cart.reduce((a, b) => a + b.qty, 0)}
                   </span>
                </div>
                <button 
                  onClick={onSubmitOrder} 
                  disabled={loading || cart.length === 0 || !targetWarehouseId} 
                  className="w-full o-btn o-btn-primary py-4 font-bold disabled:opacity-50 gap-2 shadow-lg"
                >
                   {loading ? <Loader2 className="animate-spin" size={20}/> : <><CheckCircle2 size={18}/> Crear Transferencia</>}
                </button>
             </div>
          </div>
       </div>
    </div>
  );
};
