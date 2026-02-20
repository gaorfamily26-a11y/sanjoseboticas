
export type UserRole = 'superadmin' | 'admin' | 'employee';

export interface Company {
  id: number;
  name: string;
}

export interface Warehouse {
  id: number;
  name: string;
  code: string;
  lot_stock_id?: [number, string];
}

export interface PosConfig {
  id: number;
  name: string;
  warehouse_id: [number, string] | false;
}

export interface Product {
  id: number;
  name: string;
  default_code?: string;
  barcode?: string;
  list_price: number;
  qty_available: number;
  sales_count?: number;
  uom_id?: [number, string];
  product_variant_id?: [number, string] | number;
}

export interface Employee {
  id: number;
  name: string;
  job_title?: string;
  work_email?: string;
  work_phone?: string;
  department_id?: [number, string];
  resource_calendar_id?: [number, string];
  user_id?: [number, string];
  image_128?: string;
}

export interface Shift {
  id: string;
  employee_id: number;
  employee_name: string;
  employee_email: string;
  pos_id: number;
  pos_name: string;
  date: string;
  shift_type: 'mañana' | 'tarde' | 'completo' | 'noche' | 'descanso';
  start_time: string;
  end_time: string;
  status: 'confirmed' | 'pending';
  created_at?: string;
  created_by?: string;
}

export interface AppConfig {
  url: string;
  db: string;
  user: string;
  apiKey: string;
  companyName: string;
  selectedCompanyId?: number;
  defaultOriginWarehouseId?: number;
  defaultDestWarehouseId?: number;
}

export interface UserSession {
  id: number;
  name: string;
  role: UserRole;
  odoo_user_id?: number;
  employee_id?: number;
  company_id?: number;
  company_name?: string;
  employee_data?: Employee;
  login_email?: string;
}
