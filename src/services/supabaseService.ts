
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://vwrugxpijvrlvehrtobr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3cnVneHBpanZybHZlaHJ0b2JyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNjQyNTYsImV4cCI6MjA4Njg0MDI1Nn0.h5MCuqa8Mx0AdSVcYNDR43CX9V3GP_Bi-TCUTzk8nyU";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const shiftService = {
  async getShifts() {
    const { data, error } = await supabase
      .from('shifts')
      .select('*')
      .order('date', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getMyShifts(email: string) {
    if (!email) return [];
    const { data, error } = await supabase
      .from('shifts')
      .select('*')
      .eq('employee_email', email.trim().toLowerCase())
      .order('date', { ascending: false });
    if (error) throw error;
    return data;
  },

  async createShifts(shiftsData: any[]) {
    const payload = shiftsData.map(s => ({
      ...s,
      employee_email: s.employee_email?.toLowerCase().trim()
    }));
    
    const { data, error } = await supabase
      .from('shifts')
      .insert(payload)
      .select();
      
    if (error) throw error;
    return data;
  },

  async deleteShift(id: string) {
    const { error } = await supabase
      .from('shifts')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
};

export const reportService = {
  async getDailyClosings(limit = 30) {
    const { data, error } = await supabase
      .from('cierres_diarios')
      .select('*')
      .order('fecha', { ascending: false })
      .order('pos_nombre', { ascending: true })
      .limit(limit);
    if (error) throw error;
    return data;
  },

  async getReportConfig() {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'report_hour')
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data?.value || '23'; // Default 11 PM
  },

  async updateReportConfig(hour: string) {
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key: 'report_hour', value: hour }, { onConflict: 'key' });
    if (error) throw error;
  }
};
