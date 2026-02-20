
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, Calendar, Clock, Plus, X, RefreshCw, 
  ChevronLeft, ChevronRight, CalendarDays, Check, 
  MapPin, Sun, Moon, Zap, Coffee,
  ShieldCheck, Briefcase, Info, ArrowRight, Eye, Trash2, Edit3, AlertCircle,
  FileSpreadsheet, Loader2, CheckCircle2
} from 'lucide-react';
import { Employee, Shift } from '../types';
import { shiftService } from '../services/supabaseService';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// ─── Constantes ───────────────────────────────────────────────────────────────
const SHIFT_HOURS: Record<string, number> = {
  mañana: 8, tarde: 8, completo: 10, noche: 8, descanso: 0,
};
const SHIFT_COLORS: Record<string, { bg: string; fg: string; emoji: string }> = {
  mañana:   { bg: 'DBEAFE', fg: '1E40AF', emoji: '🌅' },
  tarde:    { bg: 'FEF9C3', fg: '92400E', emoji: '🌇' },
  completo: { bg: 'DCFCE7', fg: '166534', emoji: '⚡' },
  noche:    { bg: 'EDE9FE', fg: '5B21B6', emoji: '🌙' },
  descanso: { bg: 'F1F5F9', fg: '64748B', emoji: '🛌' },
};
const MESES_ES = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio',
                  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DIAS_ES  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const TAB_COLORS = ['714B67','017E84','2563EB','D97706','059669','DC2626','7C3AED','0891B2','65A30D','BE185D'];
const META_HORAS = 192;

// ─── Helpers de estilo ExcelJS ────────────────────────────────────────────────
const thin = { style: 'thin' as const, color: { argb: 'FFE2E8F0' } };
const fullBorder = { top: thin, left: thin, bottom: thin, right: thin };

function hdrCell(ws: ExcelJS.Worksheet, row: number, col: number, value: string | number, bgArgb: string, fgArgb = 'FFFFFFFF', bold = true, size = 10) {
  const c = ws.getCell(row, col);
  c.value = value;
  c.font = { name: 'Arial', size, bold, color: { argb: fgArgb } };
  c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
  c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  c.border = fullBorder;
}

function dataCell(ws: ExcelJS.Worksheet, row: number, col: number, value: string | number | null, opts: {
  bold?: boolean; center?: boolean; bgArgb?: string; fgArgb?: string; numFmt?: string;
} = {}) {
  const c = ws.getCell(row, col);
  c.value = value;
  c.font = { name: 'Arial', size: 9, bold: opts.bold ?? false, color: { argb: opts.fgArgb ?? 'FF1E293B' } };
  c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opts.bgArgb ?? 'FFFFFFFF' } };
  c.alignment = { horizontal: opts.center ? 'center' : 'left', vertical: 'middle' };
  c.border = fullBorder;
  if (opts.numFmt) c.numFmt = opts.numFmt;
}

// ─── Hoja resumen mensual consolidado ────────────────────────────────────────
function buildSummarySheet(wb: ExcelJS.Workbook, shifts: Shift[]) {
  const ws = wb.addWorksheet('📊 Resumen General', { properties: { tabColor: { argb: 'FF1E293B' } } });
  ws.views = [{ showGridLines: false }];
  ws.columns = [
    { width: 16 },{ width: 26 },{ width: 28 },{ width: 20 },
    { width: 11 },{ width: 11 },{ width: 12 },{ width: 11 },{ width: 12 },
    { width: 10 },{ width: 14 },{ width: 12 },{ width: 13 },{ width: 15 },
  ];

  // Título
  ws.mergeCells('A1:N1');
  const t = ws.getCell('A1');
  t.value = 'BOTICAS SAN JOSÉ — RESUMEN MENSUAL DE HORAS POR EMPLEADO';
  t.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
  t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  t.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 30;

  ws.mergeCells('A2:N2');
  const s = ws.getCell('A2');
  s.value = `Mañana=8h | Tarde=8h | Noche=8h | Completo=10h | Descanso=0h   ·   Meta: ${META_HORAS}h/mes   ·   ${new Date().toLocaleDateString('es-PE')}`;
  s.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF64748B' } };
  s.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  s.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 16;

  const hdrs = ['MES/AÑO','EMPLEADO','EMAIL','SEDE','🌅 MAÑ','🌇 TARDE','⚡ COMP','🌙 NOCHE','🛌 DESC','DÍAS LAB','HRS TOTAL','PROM H/DÍA','META','CUMPL %'];
  hdrs.forEach((h, i) => hdrCell(ws, 3, i + 1, h, i < 4 ? 'FF1E293B' : 'FF714B67'));
  ws.getRow(3).height = 22;

  // Agrupar datos
  const map = new Map<string, any>();
  shifts.forEach(sh => {
    let sortKey = '9999-99', mesAño = '?';
    try { const d = new Date(sh.date + 'T00:00:00'); sortKey = d.toISOString().substring(0, 7); mesAño = `${MESES_ES[d.getMonth() + 1]} ${d.getFullYear()}`; } catch {}
    const key = `${sortKey}||${sh.employee_name}||${sh.pos_name}`;
    if (!map.has(key)) map.set(key, { sortKey, mesAño, name: sh.employee_name, email: sh.employee_email, sede: sh.pos_name, mañana:0,tarde:0,completo:0,noche:0,descanso:0,dias:0,total:0 });
    const e = map.get(key);
    if (sh.shift_type in e) e[sh.shift_type]++;
    e.total += SHIFT_HOURS[sh.shift_type] ?? 0;
    if (sh.shift_type !== 'descanso') e.dias++;
  });

  const rows = Array.from(map.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey) || a.name.localeCompare(b.name));
  rows.forEach((r, i) => {
    const rowNum = i + 4;
    const bg = i % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';
    const prom = r.dias > 0 ? Math.round((r.total / r.dias) * 10) / 10 : 0;
    const pct = Math.round((r.total / META_HORAS) * 1000) / 10;
    const ok = r.total >= META_HORAS;

    dataCell(ws, rowNum, 1, r.mesAño, { bold: true, center: true, bgArgb: bg });
    dataCell(ws, rowNum, 2, r.name.toUpperCase(), { bold: true, bgArgb: bg });
    dataCell(ws, rowNum, 3, r.email, { bgArgb: bg });
    dataCell(ws, rowNum, 4, r.sede, { bgArgb: bg });
    (['mañana','tarde','completo','noche','descanso'] as const).forEach((st, si) => {
      const cnt = r[st] || 0;
      const sc = SHIFT_COLORS[st];
      dataCell(ws, rowNum, si + 5, cnt > 0 ? cnt : '—', { center: true, bgArgb: cnt > 0 ? `FF${sc.bg}` : bg, fgArgb: cnt > 0 ? `FF${sc.fg}` : 'FF94A3B8', bold: cnt > 0 });
    });
    dataCell(ws, rowNum, 10, r.dias, { bold: true, center: true, bgArgb: bg });
    const hc = ws.getCell(rowNum, 11);
    hc.value = r.total; hc.numFmt = '0.0"h"';
    hc.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF714B67' } };
    hc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDF4FF' } };
    hc.alignment = { horizontal: 'center', vertical: 'middle' }; hc.border = fullBorder;
    dataCell(ws, rowNum, 12, prom, { center: true, bgArgb: bg, numFmt: '0.0"h"' });
    dataCell(ws, rowNum, 13, META_HORAS, { center: true, bgArgb: bg, numFmt: '0"h"' });
    const mc = ws.getCell(rowNum, 14);
    mc.value = `${ok ? '✅' : '⚠️'} ${pct}%`;
    mc.font = { name: 'Arial', size: 9, bold: true, color: { argb: ok ? 'FF166534' : 'FF92400E' } };
    mc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ok ? 'FFDCFCE7' : 'FFFEF9C3' } };
    mc.alignment = { horizontal: 'center', vertical: 'middle' }; mc.border = fullBorder;
    ws.getRow(rowNum).height = 17;
  });

  // Fila totales
  const lr = rows.length + 4;
  ws.mergeCells(`A${lr}:D${lr}`);
  const tc = ws.getCell(`A${lr}`); tc.value = 'TOTALES GLOBALES';
  tc.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
  tc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  tc.alignment = { horizontal: 'right', vertical: 'middle' }; tc.border = fullBorder;
  ws.getRow(lr).height = 20;
  (['mañana','tarde','completo','noche','descanso'] as const).forEach((st, si) => {
    const tot = rows.reduce((a, b) => a + (b[st] || 0), 0);
    hdrCell(ws, lr, si + 5, tot, 'FF1E293B');
  });
  hdrCell(ws, lr, 10, rows.reduce((a, b) => a + b.dias, 0), 'FF1E293B');
  const th = ws.getCell(lr, 11); th.value = rows.reduce((a, b) => a + b.total, 0);
  th.numFmt = '0.0"h"'; th.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
  th.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  th.alignment = { horizontal: 'center', vertical: 'middle' }; th.border = fullBorder;
  [12,13,14].forEach(c => hdrCell(ws, lr, c, '', 'FF1E293B'));

  ws.views = [{ state: 'frozen', ySplit: 3, showGridLines: false }];
}

// ─── Hoja por empleado ────────────────────────────────────────────────────────
function buildEmployeeSheet(wb: ExcelJS.Workbook, empName: string, empEmail: string, empShifts: Shift[], tabColor: string) {
  const ws = wb.addWorksheet(empName.substring(0, 28).split(' ').slice(0, 2).join(' '), {
    properties: { tabColor: { argb: `FF${tabColor}` } }
  });
  ws.views = [{ showGridLines: false }];
  ws.columns = [{ width: 5 },{ width: 14 },{ width: 10 },{ width: 22 },{ width: 18 },{ width: 10 },{ width: 10 },{ width: 9 },{ width: 14 }];

  // Título
  ws.mergeCells('A1:I1');
  const t = ws.getCell('A1');
  t.value = `BOTICAS SAN JOSÉ — HORARIO: ${empName.toUpperCase()}`;
  t.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${tabColor}` } };
  t.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 28;

  ws.mergeCells('A2:I2');
  const s = ws.getCell('A2');
  s.value = `📧 ${empEmail}   ·   ${empShifts.length} turnos registrados   ·   ${new Date().toLocaleDateString('es-PE')}`;
  s.font = { name: 'Arial', size: 8, italic: true, color: { argb: 'FF64748B' } };
  s.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  s.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 15;

  // Encabezados
  ['#','FECHA','DÍA','SEDE / BOTICA','TIPO DE TURNO','ENTRADA','SALIDA','HORAS','ESTADO'].forEach((h, i) => {
    hdrCell(ws, 3, i + 1, h, 'FF714B67');
  });
  ws.getRow(3).height = 20;

  // Turnos ordenados
  const sorted = [...empShifts].sort((a, b) => a.date.localeCompare(b.date));
  let totalHoras = 0;

  sorted.forEach((sh, i) => {
    const r = i + 4;
    const bg = i % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';
    const sc = SHIFT_COLORS[sh.shift_type] || { bg: 'FFFFFF', fg: '1E293B', emoji: '' };
    const horas = SHIFT_HOURS[sh.shift_type] ?? 0;
    totalHoras += horas;
    let dia = '—';
    try { dia = DIAS_ES[new Date(sh.date + 'T00:00:00').getDay()]; } catch {}
    const ok = sh.status === 'confirmed';

    dataCell(ws, r, 1, i + 1, { center: true, bgArgb: bg });
    dataCell(ws, r, 2, sh.date, { center: true, bgArgb: bg });
    dataCell(ws, r, 3, dia, { center: true, bgArgb: bg });
    dataCell(ws, r, 4, sh.pos_name, { bgArgb: bg });

    // Celda turno con color propio
    const tc = ws.getCell(r, 5);
    tc.value = `${sc.emoji} ${sh.shift_type.toUpperCase()}`;
    tc.font = { name: 'Arial', size: 9, bold: true, color: { argb: `FF${sc.fg}` } };
    tc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${sc.bg}` } };
    tc.alignment = { horizontal: 'center', vertical: 'middle' }; tc.border = fullBorder;

    dataCell(ws, r, 6, sh.start_time || '—', { center: true, bgArgb: bg });
    dataCell(ws, r, 7, sh.end_time || '—', { center: true, bgArgb: bg });

    const hc = ws.getCell(r, 8);
    hc.value = horas; hc.numFmt = '0.0"h"';
    hc.font = { name: 'Arial', size: 9, bold: true, color: { argb: horas === 0 ? 'FF94A3B8' : 'FF714B67' } };
    hc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    hc.alignment = { horizontal: 'center', vertical: 'middle' }; hc.border = fullBorder;

    const ec = ws.getCell(r, 9);
    ec.value = ok ? '✅ Confirmado' : '⏳ Pendiente';
    ec.font = { name: 'Arial', size: 8, bold: true, color: { argb: ok ? 'FF166534' : 'FF92400E' } };
    ec.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ok ? 'FFDCFCE7' : 'FFFEF9C3' } };
    ec.alignment = { horizontal: 'center', vertical: 'middle' }; ec.border = fullBorder;
    ws.getRow(r).height = 17;
  });

  // Fila total horas
  const lr = sorted.length + 4;
  ws.mergeCells(`A${lr}:G${lr}`);
  const lc = ws.getCell(`A${lr}`); lc.value = 'TOTAL HORAS TRABAJADAS';
  lc.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  lc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${tabColor}` } };
  lc.alignment = { horizontal: 'right', vertical: 'middle' }; lc.border = fullBorder;
  ws.getRow(lr).height = 22;

  const hc = ws.getCell(lr, 8); hc.value = totalHoras; hc.numFmt = '0.0"h"';
  hc.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  hc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${tabColor}` } };
  hc.alignment = { horizontal: 'center', vertical: 'middle' }; hc.border = fullBorder;

  const pct = Math.round((totalHoras / META_HORAS) * 1000) / 10;
  const ok = totalHoras >= META_HORAS;
  const mc = ws.getCell(lr, 9); mc.value = `${ok ? '✅' : '⚠️'} ${pct}% de ${META_HORAS}h`;
  mc.font = { name: 'Arial', size: 9, bold: true, color: { argb: ok ? 'FF166534' : 'FF92400E' } };
  mc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ok ? 'FFDCFCE7' : 'FFFEF9C3' } };
  mc.alignment = { horizontal: 'center', vertical: 'middle' }; mc.border = fullBorder;

  // Mini resumen por tipo de turno
  const sr = lr + 2;
  ws.mergeCells(`A${sr}:I${sr}`);
  hdrCell(ws, sr, 1, 'RESUMEN POR TIPO DE TURNO', 'FF017E84');
  ws.mergeCells(`A${sr}:I${sr}`);
  ws.getRow(sr).height = 18;

  let col = 1;
  Object.entries(SHIFT_COLORS).forEach(([st, sc]) => {
    const cnt = empShifts.filter(s => s.shift_type === st).length;
    const hrs = cnt * (SHIFT_HOURS[st] ?? 0);
    const lc2 = ws.getCell(sr + 1, col);
    lc2.value = `${sc.emoji} ${st.toUpperCase()}`;
    lc2.font = { name: 'Arial', size: 8, bold: true, color: { argb: `FF${sc.fg}` } };
    lc2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${sc.bg}` } };
    lc2.alignment = { horizontal: 'center', vertical: 'middle' }; lc2.border = fullBorder;
    const vc = ws.getCell(sr + 1, col + 1);
    vc.value = `${cnt}d · ${hrs}h`;
    vc.font = { name: 'Arial', size: 8, bold: true, color: { argb: 'FF1E293B' } };
    vc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    vc.alignment = { horizontal: 'center', vertical: 'middle' }; vc.border = fullBorder;
    col += 2;
    ws.getRow(sr + 1).height = 18;
  });

  ws.views = [{ state: 'frozen', ySplit: 3, showGridLines: false }];
}

// ─── Hoja referencia ──────────────────────────────────────────────────────────
function buildReferenceSheet(wb: ExcelJS.Workbook) {
  const ws = wb.addWorksheet('📖 Referencia', { properties: { tabColor: { argb: 'FF64748B' } } });
  ws.views = [{ showGridLines: false }];
  ws.columns = [{ width: 5 },{ width: 22 },{ width: 14 },{ width: 28 },{ width: 20 },{ width: 16 }];

  ws.mergeCells('B1:F1');
  hdrCell(ws, 1, 2, 'BOTICAS SAN JOSÉ — REFERENCIA DE TURNOS Y CÁLCULO DE HORAS', 'FF1E293B', 'FFFFFFFF', true, 12);
  ws.mergeCells('B1:F1');
  ws.getRow(1).height = 26;

  ['TURNO','HORAS/DÍA','HORARIO','DESCRIPCIÓN','VISTA PREVIA'].forEach((h, i) => hdrCell(ws, 3, i + 2, h, 'FF714B67'));
  ws.getRow(3).height = 20;

  const turnos = [
    ['🌅 Mañana','mañana',8,'07:00 — 15:00','Turno apertura de botica'],
    ['🌇 Tarde','tarde',8,'14:00 — 22:00','Turno cierre de botica'],
    ['⚡ Completo','completo',10,'08:00 — 18:00','Turno extendido'],
    ['🌙 Noche','noche',8,'22:00 — 06:00','Turno nocturno'],
    ['🛌 Descanso','descanso',0,'—','Día libre / franco'],
  ];
  turnos.forEach(([label, st, hrs, horario, desc], i) => {
    const r = i + 4;
    const sc = SHIFT_COLORS[st as string];
    [label, hrs, horario, desc].forEach((v, ci) => {
      const c = ws.getCell(r, ci + 2);
      c.value = v; c.font = { name: 'Arial', size: 9, bold: ci === 0, color: { argb: ci === 0 ? `FF${sc.fg}` : 'FF1E293B' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${sc.bg}` } };
      c.alignment = { horizontal: ci < 3 ? 'center' : 'left', vertical: 'middle' }; c.border = fullBorder;
    });
    const vc = ws.getCell(r, 6); vc.value = '  Vista previa  ';
    vc.font = { name: 'Arial', size: 9, bold: true, color: { argb: `FF${sc.fg}` } };
    vc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${sc.bg}` } };
    vc.alignment = { horizontal: 'center', vertical: 'middle' }; vc.border = fullBorder;
    ws.getRow(r).height = 20;
  });

  ws.mergeCells('B10:F10');
  hdrCell(ws, 10, 2, '📐 FÓRMULAS DE CÁLCULO', 'FF017E84', 'FFFFFFFF', true, 10);
  ws.mergeCells('B10:F10');
  ws.getRow(10).height = 22;

  [
    ['Meta mensual:', '192 horas', '24 días laborables × 8 horas'],
    ['Total horas:', 'Σ (días × horas_turno)', 'Suma ponderada por tipo de turno'],
    ['Cumplimiento:', '(Horas / 192) × 100', '% sobre meta mensual'],
    ['Promedio h/día:', 'Horas / Días laborables', 'Excluye días de descanso'],
  ].forEach(([lbl, formula, nota], i) => {
    const r = i + 11;
    ws.getRow(r).height = 18;
    const lc = ws.getCell(r, 2); lc.value = lbl; lc.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF1E293B' } };
    lc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDFA' } };
    lc.alignment = { horizontal: 'right', vertical: 'middle' }; lc.border = fullBorder;
    const fc = ws.getCell(r, 3); fc.value = formula; fc.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF714B67' } };
    fc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDFA' } };
    fc.alignment = { horizontal: 'center', vertical: 'middle' }; fc.border = fullBorder;
    ws.mergeCells(`D${r}:F${r}`);
    const nc = ws.getCell(r, 4); nc.value = nota; nc.font = { name: 'Arial', size: 9, color: { argb: 'FF1E293B' } };
    nc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDFA' } };
    nc.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }; nc.border = fullBorder;
  });
}

// ─── Función principal de exportación ────────────────────────────────────────
async function exportShiftsToExcel(shifts: Shift[]) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Boticas San José — Centro de Operaciones';
  wb.created = new Date();

  // Hoja resumen primero
  buildSummarySheet(wb, shifts);
  buildReferenceSheet(wb);

  // Una pestaña por empleado
  const empMap = new Map<number, { name: string; email: string; shifts: Shift[] }>();
  shifts.forEach(sh => {
    if (!empMap.has(sh.employee_id)) empMap.set(sh.employee_id, { name: sh.employee_name, email: sh.employee_email, shifts: [] });
    empMap.get(sh.employee_id)!.shifts.push(sh);
  });

  Array.from(empMap.entries())
    .sort((a, b) => a[1].name.localeCompare(b[1].name))
    .forEach(([, emp], i) => {
      buildEmployeeSheet(wb, emp.name, emp.email, emp.shifts, TAB_COLORS[i % TAB_COLORS.length]);
    });

  // Generar y descargar
  const buffer = await wb.xlsx.writeBuffer();
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
  saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `Horarios_BoticasSanJose_${dateStr}.xlsx`);
}

// ─── Botón de exportación ─────────────────────────────────────────────────────
const ExportShiftsButton: React.FC<{ shifts: Shift[] }> = ({ shifts }) => {
  const [status, setStatus] = useState<'idle'|'loading'|'done'>('idle');
  const totalHoras = shifts.reduce((acc, sh) => acc + (SHIFT_HOURS[sh.shift_type] ?? 0), 0);
  const uniqueEmps = new Set(shifts.map(s => s.employee_id)).size;

  const handle = async () => {
    if (status === 'loading') return;
    setStatus('loading');
    try {
      await exportShiftsToExcel(shifts);
      setStatus('done');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (e) { console.error(e); setStatus('idle'); }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handle}
        disabled={status === 'loading' || shifts.length === 0}
        title={`${shifts.length} turnos · ${uniqueEmps} empleados · ${totalHoras}h`}
        className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all shadow-sm
          ${status === 'done'    ? 'bg-emerald-500 text-white shadow-emerald-200'
          : status === 'loading' ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
          : 'bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-400 hover:shadow-md hover:-translate-y-0.5'}`}
      >
        {status === 'loading' && <Loader2 size={16} className="animate-spin"/>}
        {status === 'done'    && <CheckCircle2 size={16}/>}
        {status === 'idle'    && <FileSpreadsheet size={16}/>}
        <span>{status === 'loading' ? 'Generando...' : status === 'done' ? '¡Descargado!' : 'Exportar Excel'}</span>
        {status === 'idle' && (
          <span className="bg-emerald-100 text-emerald-600 text-[9px] px-1.5 py-0.5 rounded-full font-black">{shifts.length}</span>
        )}
      </button>
      {status === 'idle' && shifts.length > 0 && (
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
          {uniqueEmps} empleados · {totalHoras}h registradas
        </p>
      )}
    </div>
  );
};

const DAYS_OF_WEEK = [
  { label: 'Dom', value: 0 },
  { label: 'Lun', value: 1 },
  { label: 'Mar', value: 2 },
  { label: 'Mié', value: 3 },
  { label: 'Jue', value: 4 },
  { label: 'Vie', value: 5 },
  { label: 'Sáb', value: 6 },
];

const EmployeeCalendar = ({ 
  employee, 
  shifts, 
  onClose,
  isFullView = false,
  isAdmin = false,
  onRefresh
}: { 
  employee: Employee; 
  shifts: Shift[]; 
  onClose?: () => void;
  isFullView?: boolean;
  isAdmin?: boolean;
  onRefresh?: () => void;
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const daysInMonth = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const days = new Date(year, month + 1, 0).getDate();
    return { firstDay, days, year, month };
  }, [currentDate]);

  const monthName = currentDate.toLocaleString('es-PE', { month: 'long', year: 'numeric' });

  const getShiftForDay = (day: number) => {
    const dateStr = `${daysInMonth.year}-${String(daysInMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return shifts.find(s => s.date === dateStr);
  };

  const handleDeleteShift = async (id: string) => {
    if (!isAdmin) return;
    if (confirm("¿Eliminar este turno específico?")) {
      try {
        await shiftService.deleteShift(id);
        if (onRefresh) onRefresh();
      } catch (e) { alert("Error al eliminar"); }
    }
  };

  const calendarContent = (
    <div className={`bg-white h-full shadow-2xl flex flex-col ${!isFullView ? 'relative w-full max-w-4xl animate-in slide-in-from-right duration-500' : 'rounded-[40px] border border-slate-200'}`}>
        <div className="bg-white px-8 py-6 border-b flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-odoo-primary rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-odoo-primary/20">
              {employee.name.charAt(0)}
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight leading-none">{employee.name}</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-2 flex items-center gap-2">
                <CalendarDays size={14}/> Mapa Operativo Personal
              </p>
            </div>
          </div>
          {onClose && (
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
              <X size={28}/>
            </button>
          )}
        </div>

        <div className="px-8 py-4 bg-slate-50 border-b flex flex-wrap justify-between items-center gap-6 shrink-0">
          <div className="flex items-center gap-3 bg-white px-5 py-2.5 rounded-2xl border border-slate-200 shadow-sm">
            <button onClick={() => setCurrentDate(new Date(daysInMonth.year, daysInMonth.month - 1, 1))} className="text-slate-400 hover:text-odoo-primary p-1"><ChevronLeft size={20}/></button>
            <h4 className="text-[11px] font-black text-slate-700 uppercase min-w-[180px] text-center tracking-[0.2em]">{monthName}</h4>
            <button onClick={() => setCurrentDate(new Date(daysInMonth.year, daysInMonth.month + 1, 1))} className="text-slate-400 hover:text-odoo-primary p-1"><ChevronRight size={20}/></button>
          </div>
          <div className="flex gap-8">
             <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-lg bg-emerald-600 border border-emerald-700"></div>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">TRABAJO</span>
             </div>
             <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-lg bg-slate-400 border border-slate-500"></div>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">DESCANSO</span>
             </div>
          </div>
        </div>

        <div className="flex-1 p-8 bg-slate-100/50 overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-7 gap-3 max-w-4xl mx-auto">
            {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(d => (
              <div key={d} className="text-center text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] pb-4">{d}</div>
            ))}
            {Array.from({ length: daysInMonth.firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square bg-slate-200/20 rounded-[24px] border border-slate-200/50" />
            ))}
            {Array.from({ length: daysInMonth.days }).map((_, i) => {
              const day = i + 1;
              const shift = getShiftForDay(day);
              const isToday = new Date().toDateString() === new Date(daysInMonth.year, daysInMonth.month, day).toDateString();
              const isWork = shift && shift.shift_type !== 'descanso';
              const isRest = shift && shift.shift_type === 'descanso';
              
              return (
                <div key={day} className={`relative aspect-square rounded-[24px] p-3 border-2 transition-all flex flex-col items-center justify-center text-center overflow-hidden shadow-sm group ${isWork ? 'bg-emerald-600 border-emerald-700 text-white' : isRest ? 'bg-slate-400 border-slate-500 text-white' : 'bg-white border-slate-200 text-slate-300 border-dashed'} ${isToday ? 'ring-4 ring-odoo-primary/40 scale-[1.05] z-10 shadow-xl' : ''}`}>
                  <div className="absolute top-2 left-3">
                    <span className={`text-xs font-black ${isWork || isRest ? 'text-white/60' : (isToday ? 'text-odoo-primary' : 'text-slate-300')}`}>{day}</span>
                  </div>
                  
                  {isAdmin && shift && (
                    <button onClick={() => handleDeleteShift(shift.id)} className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-lg">
                      <Trash2 size={12} />
                    </button>
                  )}

                  {shift ? (
                    <div className="flex flex-col items-center w-full">
                      <span className="text-[9px] font-black uppercase tracking-[0.1em]">{isRest ? 'DESC.' : 'TRAB.'}</span>
                      {isWork && (
                        <div className="mt-1 flex flex-col items-center pt-1 border-t border-white/20 w-full">
                           <div className="flex items-center gap-1 text-[11px] font-black leading-none">
                             {shift.start_time.slice(0,5)}
                           </div>
                           <p className="text-[7px] font-bold uppercase opacity-80 mt-1 truncate max-w-full">{shift.pos_name}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-[8px] font-black opacity-10">LIBRE</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
    </div>
  );

  return isFullView ? calendarContent : (
    <div className="fixed inset-0 z-[600] flex items-center justify-end animate-fade">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      {calendarContent}
    </div>
  );
};

export const StaffManagement: React.FC<{isAdmin: boolean; employees: Employee[]; posConfigs: any[]; currentUserEmail?: string; loading: boolean;}> = ({ isAdmin, employees, posConfigs, currentUserEmail, loading: odooLoading }) => {
  const [view, setView] = useState<'roster' | 'global' | 'me'>(isAdmin ? 'roster' : 'me');
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [dbLoading, setDbLoading] = useState(false);
  const [showAddShift, setShowAddShift] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [viewCalendarEmp, setViewCalendarEmp] = useState<Employee | null>(null);
  const [shiftType, setShiftType] = useState<'mañana' | 'tarde' | 'completo' | 'noche'>('mañana');
  const [restDays, setRestDays] = useState<number[]>([0]);

  const loadShifts = async () => {
    setDbLoading(true);
    try {
      const data = isAdmin ? await shiftService.getShifts() : (currentUserEmail ? await shiftService.getMyShifts(currentUserEmail) : []);
      setShifts(data || []);
    } catch (e) { console.error(e); } finally { setDbLoading(false); }
  };

  useEffect(() => { loadShifts(); }, [isAdmin, currentUserEmail]);

  const me = useMemo(() => {
    if (isAdmin) return null;
    return employees.find(e => e.work_email?.toLowerCase().trim() === currentUserEmail?.toLowerCase().trim());
  }, [employees, currentUserEmail, isAdmin]);

  // Resumen de cada empleado para mostrar en las tarjetas (Fichas Staff)
  const employeeSummaries = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    
    return employees.map(emp => {
      const empShifts = shifts.filter(s => Number(s.employee_id) === Number(emp.id));
      const todayShift = empShifts.find(s => s.date === today);
      const monthShifts = empShifts.filter(s => {
        const d = new Date(s.date + 'T00:00:00');
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      });

      return {
        ...emp,
        today: todayShift,
        monthWork: monthShifts.filter(s => s.shift_type !== 'descanso').length,
        monthRest: monthShifts.filter(s => s.shift_type === 'descanso').length,
        totalMonth: monthShifts.length,
        ids: monthShifts.map(s => s.id)
      };
    });
  }, [employees, shifts]);

  const handleClearMonth = async (empIds: string[], name: string) => {
    if (!isAdmin) return;
    if (confirm(`¿Estás seguro de eliminar TODOS los turnos de este mes para ${name}? Esta acción no se puede deshacer.`)) {
      setDbLoading(true);
      try {
        await Promise.all(empIds.map(id => shiftService.deleteShift(id)));
        await loadShifts();
      } catch (e) { alert("Error al limpiar mes"); } finally { setDbLoading(false); }
    }
  };

  const handleAddShiftRange = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setDbLoading(true);
    const formData = new FormData(e.currentTarget);
    const empId = Number(formData.get('employee_id'));
    const posId = Number(formData.get('pos_id'));
    const startDateStr = formData.get('start_date') as string;
    const endDateStr = formData.get('end_date') as string;
    const emp = employees.find(e => e.id === empId);
    const pos = posConfigs.find(p => p.id === posId);
    const start = new Date(startDateStr + 'T00:00:00');
    const end = new Date(endDateStr + 'T00:00:00');
    const shiftBatch: any[] = [];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const isRestDay = restDays.includes(d.getDay());
      shiftBatch.push({
        employee_id: empId,
        employee_name: emp?.name || 'Desconocido',
        employee_email: emp?.work_email || '',
        pos_id: isRestDay ? 0 : posId,
        pos_name: isRestDay ? 'DESCANSO' : (pos?.name || 'Botica SJ'),
        date: d.toISOString().split('T')[0],
        shift_type: isRestDay ? 'descanso' : shiftType,
        start_time: isRestDay ? '00:00:00' : `${formData.get('start')}:00`,
        end_time: isRestDay ? '00:00:00' : `${formData.get('end')}:00`,
        status: 'confirmed',
        created_by: currentUserEmail
      });
    }

    try {
      await shiftService.createShifts(shiftBatch);
      setShowAddShift(false);
      await loadShifts();
    } catch (e: any) { alert(e.message); } finally { setDbLoading(false); }
  };

  if (!isAdmin) {
    return (
      <div className="max-w-[1400px] mx-auto space-y-8 animate-fade pb-32">
        <div className="bg-white p-10 border border-slate-200 rounded-[40px] shadow-sm flex justify-between items-center mb-6">
           <div>
              <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Mi Horario Personal</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Acceso restringido: Empleado San José</p>
           </div>
           <button onClick={loadShifts} className="p-4 bg-slate-50 rounded-2xl text-slate-400 hover:text-odoo-primary transition-all">
             <RefreshCw size={24} className={dbLoading ? 'animate-spin' : ''}/>
           </button>
        </div>
        {me ? <div className="h-[80vh]"><EmployeeCalendar employee={me} shifts={shifts} isFullView /></div> : <div className="p-20 text-center opacity-30 uppercase font-black tracking-widest">No vinculado</div>}
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-8 animate-fade pb-32">
      <div className="bg-white p-10 border border-slate-200 rounded-[40px] shadow-sm flex flex-col md:flex-row justify-between items-center gap-8">
        <div className="flex items-center gap-8">
          <div className="p-5 bg-odoo-primary text-white rounded-3xl shadow-xl shadow-odoo-primary/20"><Users size={32}/></div>
          <div>
            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter leading-none">Gestión RRHH San José</h2>
            <div className="flex items-center gap-3 mt-2">
               <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.4em]">Panel de Control Administrador</p>
            </div>
          </div>
        </div>
        <div className="flex bg-slate-100 p-2 rounded-[24px] border border-slate-200 shadow-inner">
           <button onClick={() => setView('roster')} className={`px-10 py-3.5 rounded-[18px] text-[11px] font-black uppercase tracking-widest transition-all ${view === 'roster' ? 'bg-white text-odoo-primary shadow-lg' : 'text-slate-400'}`}>Staff</button>
           <button onClick={() => setView('global')} className={`px-10 py-3.5 rounded-[18px] text-[11px] font-black uppercase tracking-widest transition-all ${view === 'global' ? 'bg-white text-odoo-primary shadow-lg' : 'text-slate-400'}`}>Consolidado</button>
        </div>
      </div>

      {view === 'roster' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {employeeSummaries.map(emp => {
            const isWorking = emp.today && emp.today.shift_type !== 'descanso';
            const isResting = emp.today && emp.today.shift_type === 'descanso';
            return (
              <div key={emp.id} className="bg-white border border-slate-200 rounded-[40px] p-8 hover:border-odoo-primary/40 transition-all shadow-sm flex flex-col items-center group relative overflow-hidden">
                <div className="w-20 h-20 bg-slate-50 rounded-[28px] flex items-center justify-center text-3xl font-black text-odoo-primary mb-4 group-hover:bg-odoo-primary group-hover:text-white transition-all shadow-inner">{emp.name.charAt(0)}</div>
                <h3 className="text-sm font-black text-slate-800 uppercase text-center line-clamp-1 mb-1">{emp.name}</h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-6">{emp.job_title || 'COLABORADOR'}</p>
                
                {/* Indicador de Estado Hoy */}
                <div className={`w-full py-4 rounded-3xl border flex flex-col items-center transition-all ${isWorking ? 'bg-emerald-600 border-emerald-700 text-white shadow-lg' : isResting ? 'bg-slate-400 border-slate-500 text-white shadow-lg' : 'bg-slate-50 border-slate-100 border-dashed'}`}>
                   <span className={`text-[8px] font-black uppercase tracking-widest mb-1 ${isWorking || isResting ? 'text-white/60' : 'text-slate-400'}`}>Estado Hoy</span>
                   <p className="text-[11px] font-black uppercase tracking-tight">{isWorking ? emp.today?.shift_type : isResting ? 'DESCANSO' : 'SIN ROL'}</p>
                   {isWorking && <p className="text-[8px] font-bold opacity-70 mt-1">{emp.today?.pos_name}</p>}
                </div>

                {/* Resumen de Carga Mensual */}
                <div className="w-full mt-6 space-y-2">
                   <div className="flex justify-between text-[9px] font-black text-slate-400 uppercase">
                      <span>Progreso Mes</span>
                      <span>{emp.monthWork} Trab. / {emp.monthRest} Desc.</span>
                   </div>
                   <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                      <div className="bg-emerald-500 h-full" style={{ width: `${(emp.monthWork / 30) * 100}%` }}></div>
                      <div className="bg-slate-300 h-full" style={{ width: `${(emp.monthRest / 30) * 100}%` }}></div>
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-3 w-full mt-8">
                  <button onClick={() => setViewCalendarEmp(emp)} className="bg-slate-50 text-slate-600 py-3.5 rounded-2xl text-[10px] font-black uppercase border border-slate-100 hover:bg-white transition-all">Calendario</button>
                  <button onClick={() => { setSelectedEmployee(emp); setShowAddShift(true); }} className="bg-odoo-primary text-white py-3.5 rounded-2xl text-[10px] font-black uppercase shadow-lg shadow-odoo-primary/20">Programar</button>
                </div>

                {/* CRUD COMPLETO: Botón para Limpiar Todo el Mes */}
                {emp.totalMonth > 0 && (
                  <button onClick={() => handleClearMonth(emp.ids, emp.name)} className="mt-4 text-[9px] font-black text-red-400 hover:text-red-600 uppercase flex items-center gap-2 transition-colors">
                    <Trash2 size={12}/> Limpiar Programación Mes
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {view === 'global' && (
        <div className="bg-white border border-slate-200 rounded-[40px] overflow-hidden shadow-sm animate-fade">
           <div className="px-12 py-8 border-b bg-slate-50/50 flex justify-between items-center">
              <div>
                 <h3 className="text-sm font-black text-slate-600 uppercase tracking-widest">Consolidado Mensual de Staff</h3>
                 <p className="text-[10px] font-bold text-slate-400 uppercase mt-1 tracking-widest">Resumen ejecutivo por colaborador</p>
              </div>
              <div className="flex items-center gap-4">
                 <ExportShiftsButton shifts={shifts} />
                 <button onClick={() => { setSelectedEmployee(null); setShowAddShift(true); }} className="bg-odoo-primary text-white py-4 px-10 rounded-2xl text-[11px] font-black uppercase flex items-center gap-4 shadow-xl shadow-odoo-primary/20 transition-all hover:scale-105"><Plus size={20}/> Nuevo Rol Masivo</button>
              </div>
           </div>
           <div className="overflow-x-auto">
              <table className="w-full text-left">
                 <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase border-b">
                    <tr>
                      <th className="px-12 py-8">Colaborador</th>
                      <th className="px-12 py-8 text-center">Botica Hoy</th>
                      <th className="px-12 py-8 text-center">Carga de Trabajo</th>
                      <th className="px-12 py-8 text-right">Detalles</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100 bg-white">
                    {employeeSummaries.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-12 py-6">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-[12px] font-black text-odoo-primary uppercase">{item.name.charAt(0)}</div>
                            <div>
                               <p className="font-black text-slate-800 uppercase text-xs leading-none mb-1">{item.name}</p>
                               <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{item.work_email || '-'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-12 py-6 text-center">
                          <div className="flex flex-col">
                             <span className="text-[11px] font-black text-slate-700 uppercase">{item.today ? item.today.pos_name : 'No Programado'}</span>
                             {item.today && <span className="text-[9px] font-bold text-slate-400 uppercase">{item.today.shift_type}</span>}
                          </div>
                        </td>
                        <td className="px-12 py-6">
                          <div className="flex flex-col items-center gap-2">
                             <div className="flex justify-between w-full max-w-[150px] text-[9px] font-black text-slate-400 uppercase tracking-tight">
                               <span className="text-emerald-600">Trab: {item.monthWork}</span>
                               <span className="text-slate-400">Desc: {item.monthRest}</span>
                             </div>
                             <div className="w-full max-w-[150px] h-2 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                               <div className="bg-emerald-500 h-full" style={{ width: `${(item.monthWork/30)*100}%` }}></div>
                               <div className="bg-slate-300 h-full" style={{ width: `${(item.monthRest/30)*100}%` }}></div>
                             </div>
                          </div>
                        </td>
                        <td className="px-12 py-6 text-right">
                           <div className="flex justify-end gap-2">
                              <button onClick={() => setViewCalendarEmp(item)} className="p-3 text-slate-300 hover:text-odoo-primary transition-all rounded-xl hover:bg-slate-100"><Eye size={22}/></button>
                              <button onClick={() => { setSelectedEmployee(item); setShowAddShift(true); }} className="p-3 text-slate-300 hover:text-odoo-primary transition-all rounded-xl hover:bg-slate-100"><Edit3 size={20}/></button>
                           </div>
                        </td>
                      </tr>
                    ))}
                 </tbody>
              </table>
           </div>
        </div>
      )}

      {viewCalendarEmp && <EmployeeCalendar employee={viewCalendarEmp} shifts={shifts.filter(s => Number(s.employee_id) === Number(viewCalendarEmp.id))} onClose={() => setViewCalendarEmp(null)} isAdmin={isAdmin} onRefresh={loadShifts} />}

      {showAddShift && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xl animate-fade">
           <form onSubmit={handleAddShiftRange} className="relative w-full max-w-[500px] bg-white rounded-[48px] shadow-2xl flex flex-col overflow-hidden">
              <div className="px-12 py-10 bg-slate-50 border-b flex justify-between items-center shrink-0">
                 <div className="flex items-center gap-6">
                    <div className="w-14 h-14 bg-odoo-primary rounded-2xl flex items-center justify-center text-white shadow-xl shadow-odoo-primary/20"><CalendarDays size={30}/></div>
                    <div><h3 className="text-2xl font-black uppercase text-slate-800 tracking-tighter leading-none">Cargar Nuevo Rol</h3><p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-2">Programación Inteligente</p></div>
                 </div>
                 <button type="button" onClick={() => setShowAddShift(false)} className="w-12 h-12 flex items-center justify-center bg-white rounded-2xl shadow-sm text-slate-300 hover:text-red-500 transition-all"><X size={32}/></button>
              </div>
              <div className="p-12 space-y-8 bg-white overflow-y-auto custom-scrollbar max-h-[65vh]">
                 <div className="space-y-3">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Personal a Programar</label>
                    <select name="employee_id" defaultValue={selectedEmployee?.id} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4.5 text-xs font-black text-slate-700 outline-none focus:border-odoo-primary/40 focus:bg-white transition-all">{employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
                 </div>
                 <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-3"><label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha Inicio</label><input type="date" name="start_date" required className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-xs font-black text-slate-700 outline-none" defaultValue={new Date().toISOString().split('T')[0]}/></div>
                    <div className="space-y-3"><label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha Fin</label><input type="date" name="end_date" required className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-xs font-black text-slate-700 outline-none" defaultValue={new Date().toISOString().split('T')[0]}/></div>
                 </div>
                 <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-3"><label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo de Turno</label><select value={shiftType} onChange={(e) => setShiftType(e.target.value as any)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-[11px] font-black uppercase text-slate-700 outline-none transition-all"><option value="mañana">☀ MAÑANA</option><option value="tarde">🌆 TARDE</option><option value="completo">⚡ FULL DAY</option><option value="noche">🌙 NOCHE</option></select></div>
                    <div className="space-y-3"><label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Ubicación / Botica</label><select name="pos_id" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-[11px] font-black uppercase text-slate-700 outline-none">{posConfigs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                 </div>
                 <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-3"><label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">H. Entrada</label><input type="time" name="start" required className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-xs font-black text-slate-700 outline-none" defaultValue="08:00"/></div>
                    <div className="space-y-3"><label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">H. Salida</label><input type="time" name="end" required className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-xs font-black text-slate-700 outline-none" defaultValue="21:00"/></div>
                 </div>
                 <div className="pt-8 border-t border-slate-100">
                    <label className="text-[11px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-3 mb-6"><Coffee size={20} className="text-emerald-500"/> Definir Descansos Semanales</label>
                    <div className="grid grid-cols-7 gap-2.5">{DAYS_OF_WEEK.map(day => (<button key={day.value} type="button" onClick={() => {setRestDays(prev => prev.includes(day.value) ? prev.filter(d => d !== day.value) : [...prev, day.value]);}} className={`relative py-5 rounded-2xl text-[10px] font-black uppercase transition-all border flex flex-col items-center justify-center gap-2 ${restDays.includes(day.value) ? 'bg-emerald-600 text-white border-emerald-700 shadow-xl scale-95' : 'bg-slate-50 text-slate-400 border-slate-100 hover:bg-white hover:border-slate-300'}`}>{day.label}{restDays.includes(day.value) && <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>}</button>))}</div>
                 </div>
              </div>
              <div className="px-12 py-10 bg-slate-50 border-t">
                 <button type="submit" disabled={dbLoading} className="w-full bg-odoo-primary text-white py-6 rounded-[24px] font-black uppercase text-xs tracking-widest shadow-2xl shadow-odoo-primary/30 flex items-center justify-center gap-5 active:scale-[0.97] transition-all disabled:opacity-50">{dbLoading ? <RefreshCw size={24} className="animate-spin"/> : <Check size={24}/>}<span>{dbLoading ? 'Guardando Programación...' : 'Publicar Horarios Oficiales'}</span></button>
              </div>
           </form>
        </div>
      )}
    </div>
  );
};
