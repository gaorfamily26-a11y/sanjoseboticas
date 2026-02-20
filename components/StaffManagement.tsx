
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

// ─── Constantes ───────────────────────────────────────────────────────────────
const SHIFT_HOURS: Record<string, number> = {
  mañana: 8, tarde: 8, completo: 10, noche: 8, descanso: 0,
};
const SHIFT_META: Record<string, { bg: string; fg: string; emoji: string }> = {
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

// ─── Generador XLSX nativo (XML + ZIP via base64) ─────────────────────────────
// Compatible 100% navegador sin dependencias externas

type CellStyle = {
  bgColor?: string;   // RRGGBB sin #
  fgColor?: string;   // RRGGBB sin #
  bold?: boolean;
  size?: number;
  hAlign?: 'left'|'center'|'right';
  border?: boolean;
  italic?: boolean;
  numFmt?: string;    // e.g. '0.0'
};

interface XLSXCell {
  v: string | number | null;
  s?: CellStyle;
  t?: 's'|'n';        // string | number
}

interface XLSXSheet {
  name: string;
  tabColor?: string;
  rows: (XLSXCell | null)[][];
  colWidths?: number[];
  merges?: { r1:number;c1:number;r2:number;c2:number }[];
  freezeRow?: number;
}

// Paleta de estilos centralizados
const S = {
  hdrPrimary: (extra?: CellStyle): CellStyle => ({ bgColor:'714B67', fgColor:'FFFFFF', bold:true, size:10, hAlign:'center', border:true, ...extra }),
  hdrDark:    (extra?: CellStyle): CellStyle => ({ bgColor:'1E293B', fgColor:'FFFFFF', bold:true, size:10, hAlign:'center', border:true, ...extra }),
  hdrTeal:    (extra?: CellStyle): CellStyle => ({ bgColor:'017E84', fgColor:'FFFFFF', bold:true, size:10, hAlign:'center', border:true, ...extra }),
  data:       (extra?: CellStyle): CellStyle => ({ bgColor:'FFFFFF', fgColor:'1E293B', size:9, border:true, ...extra }),
  dataAlt:    (extra?: CellStyle): CellStyle => ({ bgColor:'F8FAFC', fgColor:'1E293B', size:9, border:true, ...extra }),
  shift: (st: string, alt=false): CellStyle => {
    const m = SHIFT_META[st] || { bg:'FFFFFF', fg:'1E293B' };
    return { bgColor: m.bg, fgColor: m.fg, bold:true, size:9, hAlign:'center', border:true };
  },
  ok:  (extra?: CellStyle): CellStyle => ({ bgColor:'DCFCE7', fgColor:'166534', bold:true, size:9, hAlign:'center', border:true, ...extra }),
  warn:(extra?: CellStyle): CellStyle => ({ bgColor:'FEF9C3', fgColor:'92400E', bold:true, size:9, hAlign:'center', border:true, ...extra }),
  purple: (extra?: CellStyle): CellStyle => ({ bgColor:'FDF4FF', fgColor:'714B67', bold:true, size:10, hAlign:'center', border:true, ...extra }),
};

function cell(v: string|number|null, s?: CellStyle): XLSXCell {
  return { v, s, t: typeof v === 'number' ? 'n' : 's' };
}

// ─── Hoja resumen general ─────────────────────────────────────────────────────
function makeSummarySheet(shifts: Shift[]): XLSXSheet {
  const rows: (XLSXCell|null)[][] = [];

  rows.push([cell('BOTICAS SAN JOSÉ — RESUMEN MENSUAL DE HORAS POR EMPLEADO', S.hdrDark({ size:13, hAlign:'left' })), null,null,null,null,null,null,null,null,null,null,null,null,null]);
  rows.push([cell(`Mañana=8h | Tarde=8h | Noche=8h | Completo=10h | Descanso=0h   ·   Meta: ${META_HORAS}h/mes   ·   ${new Date().toLocaleDateString('es-PE')}`, { bgColor:'F1F5F9', fgColor:'64748B', size:9, italic:true, hAlign:'center' }), null,null,null,null,null,null,null,null,null,null,null,null,null]);
  rows.push([
    cell('MES/AÑO', S.hdrDark()), cell('EMPLEADO', S.hdrDark()), cell('EMAIL', S.hdrDark()), cell('SEDE', S.hdrDark()),
    cell('🌅 MAÑ', S.hdrPrimary()), cell('🌇 TARDE', S.hdrPrimary()), cell('⚡ COMP', S.hdrPrimary()),
    cell('🌙 NOCHE', S.hdrPrimary()), cell('🛌 DESC', S.hdrPrimary()),
    cell('DÍAS LAB', S.hdrPrimary()), cell('HRS TOTAL', S.hdrPrimary()),
    cell('PROM H/DÍA', S.hdrPrimary()), cell('META', S.hdrPrimary()), cell('CUMPL %', S.hdrPrimary()),
  ]);

  // Agrupar
  const map = new Map<string, any>();
  shifts.forEach(sh => {
    let sortKey='9999-99', mes='?';
    try { const d=new Date(sh.date+'T00:00:00'); sortKey=d.toISOString().substring(0,7); mes=`${MESES_ES[d.getMonth()+1]} ${d.getFullYear()}`; } catch {}
    const key=`${sortKey}||${sh.employee_name}||${sh.pos_name}`;
    if (!map.has(key)) map.set(key,{sortKey,mes,name:sh.employee_name,email:sh.employee_email,sede:sh.pos_name,mañana:0,tarde:0,completo:0,noche:0,descanso:0,dias:0,total:0});
    const e=map.get(key);
    if(sh.shift_type in e) e[sh.shift_type]++;
    e.total+=SHIFT_HOURS[sh.shift_type]??0;
    if(sh.shift_type!=='descanso') e.dias++;
  });

  const dataRows = Array.from(map.values()).sort((a,b)=>a.sortKey.localeCompare(b.sortKey)||a.name.localeCompare(b.name));
  dataRows.forEach((r,i) => {
    const bg = i%2===0 ? S.data() : S.dataAlt();
    const prom = r.dias>0 ? Math.round((r.total/r.dias)*10)/10 : 0;
    const pct = Math.round((r.total/META_HORAS)*1000)/10;
    const ok = r.total>=META_HORAS;
    rows.push([
      cell(r.mes, {...bg, bold:true, hAlign:'center'}),
      cell(r.name.toUpperCase(), {...bg, bold:true}),
      cell(r.email, bg),
      cell(r.sede, bg),
      ...((['mañana','tarde','completo','noche','descanso'] as const).map(st => {
        const cnt=r[st]||0;
        return cell(cnt>0?cnt:'—', cnt>0 ? S.shift(st) : {...bg, hAlign:'center', fgColor:'94A3B8'});
      })),
      cell(r.dias, {...bg, bold:true, hAlign:'center'}),
      cell(r.total, S.purple({ numFmt:'0.0' })),
      cell(prom, {...bg, hAlign:'center', numFmt:'0.0'}),
      cell(META_HORAS, {...bg, hAlign:'center'}),
      cell(`${ok?'✅':'⚠️'} ${pct}%`, ok ? S.ok() : S.warn()),
    ]);
  });

  // Totales
  rows.push([
    cell('TOTALES GLOBALES', S.hdrDark({ hAlign:'right' })), cell('',S.hdrDark()), cell('',S.hdrDark()), cell('',S.hdrDark()),
    ...(['mañana','tarde','completo','noche','descanso'] as const).map(st => cell(dataRows.reduce((a,b)=>a+(b[st]||0),0), S.hdrDark())),
    cell(dataRows.reduce((a,b)=>a+b.dias,0), S.hdrDark()),
    cell(dataRows.reduce((a,b)=>a+b.total,0), S.hdrDark({ numFmt:'0.0' })),
    cell('',S.hdrDark()), cell('',S.hdrDark()), cell('',S.hdrDark()),
  ]);

  return {
    name: 'Resumen General',
    tabColor: '1E293B',
    rows,
    colWidths: [16,26,28,20,9,9,9,9,9,10,12,12,10,13],
    merges: [
      {r1:0,c1:0,r2:0,c2:13},
      {r1:1,c1:0,r2:1,c2:13},
    ],
    freezeRow: 3,
  };
}

// ─── Hoja por empleado ────────────────────────────────────────────────────────
function makeEmployeeSheet(empName: string, empEmail: string, empShifts: Shift[], tabColor: string): XLSXSheet {
  const sorted = [...empShifts].sort((a,b)=>a.date.localeCompare(b.date));
  const rows: (XLSXCell|null)[][] = [];
  const hdrColor = { bgColor:tabColor, fgColor:'FFFFFF', bold:true, size:11, border:true };

  rows.push([cell(`BOTICAS SAN JOSÉ — HORARIO: ${empName.toUpperCase()}`, {...hdrColor, hAlign:'center'}), null,null,null,null,null,null,null,null]);
  rows.push([cell(`📧 ${empEmail}   ·   ${empShifts.length} turnos   ·   ${new Date().toLocaleDateString('es-PE')}`, { bgColor:'F1F5F9', fgColor:'64748B', size:8, italic:true, hAlign:'center' }), null,null,null,null,null,null,null,null]);
  rows.push([
    cell('#', S.hdrPrimary({ bgColor:tabColor })),
    cell('FECHA', S.hdrPrimary({ bgColor:tabColor })),
    cell('DÍA', S.hdrPrimary({ bgColor:tabColor })),
    cell('SEDE / BOTICA', S.hdrPrimary({ bgColor:tabColor })),
    cell('TIPO DE TURNO', S.hdrPrimary({ bgColor:tabColor })),
    cell('ENTRADA', S.hdrPrimary({ bgColor:tabColor })),
    cell('SALIDA', S.hdrPrimary({ bgColor:tabColor })),
    cell('HORAS', S.hdrPrimary({ bgColor:tabColor })),
    cell('ESTADO', S.hdrPrimary({ bgColor:tabColor })),
  ]);

  let totalHoras = 0;
  sorted.forEach((sh, i) => {
    const bg = i%2===0 ? S.data() : S.dataAlt();
    const horas = SHIFT_HOURS[sh.shift_type]??0;
    totalHoras += horas;
    let dia='—'; try { dia=DIAS_ES[new Date(sh.date+'T00:00:00').getDay()]; } catch {}
    const ok = sh.status==='confirmed';
    rows.push([
      cell(i+1, {...bg, hAlign:'center'}),
      cell(sh.date, {...bg, hAlign:'center'}),
      cell(dia, {...bg, hAlign:'center'}),
      cell(sh.pos_name, bg),
      cell(`${SHIFT_META[sh.shift_type]?.emoji||''} ${sh.shift_type.toUpperCase()}`, S.shift(sh.shift_type)),
      cell(sh.start_time||'—', {...bg, hAlign:'center'}),
      cell(sh.end_time||'—', {...bg, hAlign:'center'}),
      cell(horas, { bgColor:bg.bgColor, fgColor: horas===0?'94A3B8':'714B67', bold:true, size:9, hAlign:'center', border:true, numFmt:'0.0' }),
      cell(ok?'✅ Confirmado':'⏳ Pendiente', ok ? S.ok({size:8}) : S.warn({size:8})),
    ]);
  });

  // Total
  const pct = Math.round((totalHoras/META_HORAS)*1000)/10;
  const ok = totalHoras>=META_HORAS;
  rows.push([
    cell('TOTAL HORAS TRABAJADAS', {...hdrColor, hAlign:'right'}), null,null,null,null,null,null,
    cell(totalHoras, {...hdrColor, size:12, numFmt:'0.0'}),
    cell(`${ok?'✅':'⚠️'} ${pct}% de ${META_HORAS}h`, ok ? S.ok() : S.warn()),
  ]);

  // Mini resumen
  rows.push([null,null,null,null,null,null,null,null,null]);
  rows.push([cell('RESUMEN POR TIPO DE TURNO', S.hdrTeal()), null,null,null,null,null,null,null,null]);

  const summaryRow: (XLSXCell|null)[] = [];
  Object.entries(SHIFT_META).forEach(([st, m]) => {
    const cnt = empShifts.filter(s=>s.shift_type===st).length;
    const hrs = cnt*(SHIFT_HOURS[st]??0);
    summaryRow.push(cell(`${m.emoji} ${st.toUpperCase()}`, S.shift(st)));
    summaryRow.push(cell(`${cnt}d · ${hrs}h`, S.data({ hAlign:'center' })));
  });
  // Pad to 9 cols
  while (summaryRow.length < 9) summaryRow.push(null);
  rows.push(summaryRow);

  return {
    name: empName.substring(0,28).split(' ').slice(0,2).join(' '),
    tabColor,
    rows,
    colWidths: [5,13,9,22,18,9,9,9,14],
    merges: [
      {r1:0,c1:0,r2:0,c2:8},
      {r1:1,c1:0,r2:1,c2:8},
      {r1:rows.length-2,c1:0,r2:rows.length-2,c2:8},
      {r1:rows.length-3,c1:0,r2:rows.length-3,c2:6},  // total merge
    ],
    freezeRow: 3,
  };
}

// ─── Hoja referencia ──────────────────────────────────────────────────────────
function makeReferenceSheet(): XLSXSheet {
  const rows: (XLSXCell|null)[][] = [];
  rows.push([cell('BOTICAS SAN JOSÉ — REFERENCIA DE TURNOS Y CÁLCULO DE HORAS', S.hdrDark({size:12,hAlign:'center'})), null,null,null,null]);
  rows.push([null,null,null,null,null]);
  rows.push([
    cell('TURNO', S.hdrPrimary()), cell('H/DÍA', S.hdrPrimary()),
    cell('HORARIO', S.hdrPrimary()), cell('DESCRIPCIÓN', S.hdrPrimary()), cell('COLOR', S.hdrPrimary()),
  ]);
  ([
    ['mañana',  '🌅 Mañana',   8,  '07:00 — 15:00', 'Turno apertura de botica'],
    ['tarde',   '🌇 Tarde',    8,  '14:00 — 22:00', 'Turno cierre de botica'],
    ['completo','⚡ Completo', 10, '08:00 — 18:00', 'Turno extendido'],
    ['noche',   '🌙 Noche',    8,  '22:00 — 06:00', 'Turno nocturno'],
    ['descanso','🛌 Descanso',  0,  '—',            'Día libre / franco'],
  ] as const).forEach(([st, label, hrs, hor, desc]) => {
    rows.push([
      cell(label, S.shift(st as string)), cell(hrs, S.shift(st as string)),
      cell(hor, S.shift(st as string)),   cell(desc, {...S.shift(st as string), hAlign:'left'}),
      cell('  Vista previa  ', S.shift(st as string)),
    ]);
  });
  rows.push([null,null,null,null,null]);
  rows.push([cell('📐 FÓRMULAS DE CÁLCULO', S.hdrTeal({hAlign:'left'})), null,null,null,null]);
  ([
    ['Meta mensual:',   '192 horas',                    '24 días laborables × 8 horas'],
    ['Total horas:',    'Σ (días × horas_turno)',        'Suma ponderada por tipo de turno'],
    ['Cumplimiento:',   '(Horas / 192) × 100',          '% sobre meta mensual'],
    ['Promedio h/día:', 'Horas / Días laborables',       'Excluye días de descanso'],
  ] as const).forEach(([lbl, formula, nota]) => {
    rows.push([
      cell(lbl, {...S.data({hAlign:'right'}), bgColor:'F0FDFA', bold:true }),
      cell(formula, {...S.data({hAlign:'center'}), bgColor:'F0FDFA', fgColor:'714B67', bold:true }),
      cell(nota, {...S.data(), bgColor:'F0FDFA' }),
      null, null,
    ]);
  });
  return {
    name: 'Referencia',
    tabColor: '64748B',
    rows,
    colWidths: [20,14,24,36,16],
    merges: [
      {r1:0,c1:0,r2:0,c2:4},
      {r1:9,c1:0,r2:9,c2:4},
    ],
  };
}

// ─── Motor XLSX (XML nativo, sin dependencias) ────────────────────────────────
function buildXLSX(sheets: XLSXSheet[]): Blob {
  const escXml = (s: string) => String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&apos;');

  // Recolectar strings compartidos
  const sharedStrings: string[] = [];
  const ssMap = new Map<string,number>();
  function getSI(val: string): number {
    if (ssMap.has(val)) return ssMap.get(val)!;
    const idx = sharedStrings.length;
    sharedStrings.push(val); ssMap.set(val,idx);
    return idx;
  }

  // Recolectar estilos únicos
  interface StyleDef { bgColor?:string; fgColor?:string; bold?:boolean; size?:number; hAlign?:string; border?:boolean; italic?:boolean; numFmt?:string; }
  const stylesList: StyleDef[] = [{}]; // índice 0 = default
  const styleMap = new Map<string,number>();
  function getStyle(s?: CellStyle): number {
    if (!s) return 0;
    const key = JSON.stringify(s);
    if (styleMap.has(key)) return styleMap.get(key)!;
    const idx = stylesList.length;
    stylesList.push(s); styleMap.set(key,idx);
    return idx;
  }

  // Recolectar formatos numéricos únicos
  const numFmts: string[] = [];
  const numFmtMap = new Map<string,number>();
  function getNumFmtId(fmt?: string): number {
    if (!fmt) return 0;
    if (numFmtMap.has(fmt)) return numFmtMap.get(fmt)!;
    const id = 164 + numFmts.length;
    numFmts.push(fmt); numFmtMap.set(fmt,id);
    return id;
  }

  // Pre-scan para colectar styles y strings
  sheets.forEach(sh => {
    sh.rows.forEach(row => {
      if (!row) return;
      row.forEach(c => {
        if (!c) return;
        getStyle(c.s);
        if (c.s?.numFmt) getNumFmtId(c.s.numFmt);
        if (typeof c.v === 'string' && c.v !== '') getSI(c.v);
      });
    });
  });

  // Col letter helper
  function colLetter(n: number): string {
    let s=''; n++;
    while(n>0){ n--; s=String.fromCharCode(65+(n%26))+s; n=Math.floor(n/26); }
    return s;
  }

  // Generar XML de cada hoja
  function sheetXml(sh: XLSXSheet): string {
    const colsXml = sh.colWidths
      ? sh.colWidths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('')
      : '';

    const rowsXml = sh.rows.map((row, ri) => {
      if (!row || row.every(c=>c===null)) return `<row r="${ri+1}"/>`;
      const cells = row.map((c,ci) => {
        if (!c) return '';
        const addr = `${colLetter(ci)}${ri+1}`;
        const si = getStyle(c.s);
        if (typeof c.v === 'number') {
          const nfId = getNumFmtId(c.s?.numFmt);
          return `<c r="${addr}" s="${si}" t="n"><v>${c.v}</v></c>`;
        }
        if (c.v === null || c.v === '') return `<c r="${addr}" s="${si}"/>`;
        const idx = getSI(String(c.v));
        return `<c r="${addr}" s="${si}" t="s"><v>${idx}</v></c>`;
      }).join('');
      return `<row r="${ri+1}">${cells}</row>`;
    }).join('');

    const mergesXml = sh.merges && sh.merges.length > 0
      ? `<mergeCells count="${sh.merges.length}">${sh.merges.map(m=>`<mergeCell ref="${colLetter(m.c1)}${m.r1+1}:${colLetter(m.c2)}${m.r2+1}"/>`).join('')}</mergeCells>`
      : '';

    const freezeXml = sh.freezeRow
      ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${sh.freezeRow}" topLeftCell="A${sh.freezeRow+1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
      : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';

    return `<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
${freezeXml}
<cols>${colsXml}</cols>
<sheetData>${rowsXml}</sheetData>
${mergesXml}
</worksheet>`;
  }

  // Estilos XML
  function stylesXml(): string {
    const numFmtsXml = numFmts.length > 0
      ? `<numFmts count="${numFmts.length}">${numFmts.map((f,i)=>`<numFmt numFmtId="${164+i}" formatCode="${escXml(f)}"/>`).join('')}</numFmts>`
      : '<numFmts count="0"/>';

    const fonts = stylesList.map(s => `<font>
      <sz val="${s.size||9}"/>
      <color rgb="FF${s.fgColor||'1E293B'}"/>
      <name val="Arial"/>
      ${s.bold?'<b/>':''}
      ${s.italic?'<i/>':''}
    </font>`);

    const fills = [`<fill><patternFill patternType="none"/></fill>`,`<fill><patternFill patternType="gray125"/></fill>`,
      ...stylesList.map(s => s.bgColor
        ? `<fill><patternFill patternType="solid"><fgColor rgb="FF${s.bgColor}"/><bgColor indexed="64"/></patternFill></fill>`
        : `<fill><patternFill patternType="none"/></fill>`)
    ];

    const thinBorder = `<border><left style="thin"><color rgb="FFE2E8F0"/></left><right style="thin"><color rgb="FFE2E8F0"/></right><top style="thin"><color rgb="FFE2E8F0"/></top><bottom style="thin"><color rgb="FFE2E8F0"/></bottom></border>`;
    const noBorder = `<border><left/><right/><top/><bottom/></border>`;
    const borders = stylesList.map(s => s.border ? thinBorder : noBorder);

    const cellXfs = stylesList.map((s, i) => {
      const nfId = s.numFmt ? getNumFmtId(s.numFmt) : 0;
      const ha = s.hAlign || 'left';
      return `<xf numFmtId="${nfId}" fontId="${i}" fillId="${i+2}" borderId="${i}" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1" applyNumberFormat="${nfId>0?1:0}">
        <alignment horizontal="${ha}" vertical="center" wrapText="0"/>
      </xf>`;
    });

    return `<?xml version="1.0" encoding="UTF-8"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
${numFmtsXml}
<fonts count="${stylesList.length}">${fonts.join('')}</fonts>
<fills count="${fills.length}">${fills.join('')}</fills>
<borders count="${borders.length}">${borders.join('')}</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="${cellXfs.length}">${cellXfs.join('')}</cellXfs>
</styleSheet>`;
  }

  // Shared strings XML
  function ssXml(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${sharedStrings.length}" uniqueCount="${sharedStrings.length}">
${sharedStrings.map(s=>`<si><t xml:space="preserve">${escXml(s)}</t></si>`).join('')}
</sst>`;
  }

  // Workbook XML
  function workbookXml(): string {
    const sheetsXml = sheets.map((sh,i)=>
      `<sheet name="${escXml(sh.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`
    ).join('');
    return `<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${sheetsXml}</sheets>
</workbook>`;
  }

  function workbookRels(): string {
    const rels = sheets.map((sh,i)=>
      `<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`
    ).join('');
    const extra = `<Relationship Id="rId${sheets.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
<Relationship Id="rId${sheets.length+2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`;
    return `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${rels}${extra}
</Relationships>`;
  }

  // Tab colors en sheetViews no funciona en estándar OOXML, pero se puede poner en workbook
  // Usar xl/worksheets/*.xml sheetPr tabColor
  function sheetXmlWithTab(sh: XLSXSheet): string {
    const tabXml = sh.tabColor ? `<sheetPr><tabColor rgb="FF${sh.tabColor}"/></sheetPr>` : '';
    const colsXml = sh.colWidths
      ? sh.colWidths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('')
      : '';
    const rowsXml = sh.rows.map((row, ri) => {
      if (!row || row.every(c=>c===null)) return `<row r="${ri+1}"/>`;
      const cells = row.map((c,ci) => {
        if (!c) return '';
        const addr = `${colLetter(ci)}${ri+1}`;
        const si = getStyle(c.s);
        if (typeof c.v === 'number') {
          return `<c r="${addr}" s="${si}" t="n"><v>${c.v}</v></c>`;
        }
        if (c.v === null || c.v === '') return `<c r="${addr}" s="${si}"/>`;
        const idx = getSI(String(c.v));
        return `<c r="${addr}" s="${si}" t="s"><v>${idx}</v></c>`;
      }).join('');
      return `<row r="${ri+1}">${cells}</row>`;
    }).join('');
    const mergesXml = sh.merges && sh.merges.length > 0
      ? `<mergeCells count="${sh.merges.length}">${sh.merges.map(m=>`<mergeCell ref="${colLetter(m.c1)}${m.r1+1}:${colLetter(m.c2)}${m.r2+1}"/>`).join('')}</mergeCells>`
      : '';
    const freezeXml = sh.freezeRow
      ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${sh.freezeRow}" topLeftCell="A${sh.freezeRow+1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
      : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';
    return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${tabXml}${freezeXml}<cols>${colsXml}</cols><sheetData>${rowsXml}</sheetData>${mergesXml}</worksheet>`;
  }

  // Construir ZIP usando fflate (disponible globalmente en browsers modernos via importmap)
  // Usamos btoa/Blob + estructura OOXML manual como ZIP minimal
  // Implementación ZIP minimal compatible con XLSX
  function strToUint8(str: string): Uint8Array {
    return new TextEncoder().encode(str);
  }

  function makeZip(files: Record<string, Uint8Array>): Uint8Array {
    const encoder = new TextEncoder();
    const centralDir: Uint8Array[] = [];
    const localFiles: Uint8Array[] = [];
    let offset = 0;

    Object.entries(files).forEach(([name, data]) => {
      const nameBytes = encoder.encode(name);
      const crc = crc32(data);
      const local = makeLocalHeader(nameBytes, data, crc);
      localFiles.push(local);
      centralDir.push(makeCentralHeader(nameBytes, data, crc, offset));
      offset += local.length;
    });

    const cdSize = centralDir.reduce((a,b)=>a+b.length,0);
    const eocd = makeEOCD(centralDir.length, cdSize, offset);
    return concat([...localFiles, ...centralDir, eocd]);
  }

  function concat(arrays: Uint8Array[]): Uint8Array {
    const total = arrays.reduce((a,b)=>a+b.length,0);
    const out = new Uint8Array(total);
    let off=0;
    arrays.forEach(a=>{ out.set(a,off); off+=a.length; });
    return out;
  }

  function uint32LE(n: number): Uint8Array {
    const b=new Uint8Array(4);
    b[0]=n&0xFF; b[1]=(n>>8)&0xFF; b[2]=(n>>16)&0xFF; b[3]=(n>>24)&0xFF;
    return b;
  }
  function uint16LE(n: number): Uint8Array {
    return new Uint8Array([n&0xFF,(n>>8)&0xFF]);
  }

  function crc32(data: Uint8Array): number {
    const table = crc32table();
    let crc=0xFFFFFFFF;
    for(let i=0;i<data.length;i++) crc=(crc>>>8)^table[(crc^data[i])&0xFF];
    return (crc^0xFFFFFFFF)>>>0;
  }

  function crc32table(): number[] {
    const t:number[]=[];
    for(let n=0;n<256;n++){
      let c=n;
      for(let k=0;k<8;k++) c=c&1?(0xEDB88320^(c>>>1)):(c>>>1);
      t.push(c);
    }
    return t;
  }

  function makeLocalHeader(name: Uint8Array, data: Uint8Array, crc: number): Uint8Array {
    return concat([
      new Uint8Array([0x50,0x4B,0x03,0x04]), // sig
      uint16LE(20),       // version needed
      uint16LE(0),        // flags
      uint16LE(0),        // compression: store
      uint16LE(0),        // mod time
      uint16LE(0),        // mod date
      uint32LE(crc),
      uint32LE(data.length),
      uint32LE(data.length),
      uint16LE(name.length),
      uint16LE(0),        // extra len
      name,
      data,
    ]);
  }

  function makeCentralHeader(name: Uint8Array, data: Uint8Array, crc: number, offset: number): Uint8Array {
    return concat([
      new Uint8Array([0x50,0x4B,0x01,0x02]), // sig
      uint16LE(20),       // version made
      uint16LE(20),       // version needed
      uint16LE(0),        // flags
      uint16LE(0),        // compression
      uint16LE(0),        // mod time
      uint16LE(0),        // mod date
      uint32LE(crc),
      uint32LE(data.length),
      uint32LE(data.length),
      uint16LE(name.length),
      uint16LE(0),        // extra
      uint16LE(0),        // comment
      uint16LE(0),        // disk start
      uint16LE(0),        // internal attr
      uint32LE(0),        // external attr
      uint32LE(offset),
      name,
    ]);
  }

  function makeEOCD(numEntries: number, cdSize: number, cdOffset: number): Uint8Array {
    return concat([
      new Uint8Array([0x50,0x4B,0x05,0x06]),
      uint16LE(0), uint16LE(0),
      uint16LE(numEntries), uint16LE(numEntries),
      uint32LE(cdSize), uint32LE(cdOffset),
      uint16LE(0),
    ]);
  }

  // Generar sheets (necesitamos hacerlo DESPUÉS de pre-scan para tener stylesList completo)
  const sheetXmls = sheets.map(sh => strToUint8(sheetXmlWithTab(sh)));
  const stylesData = strToUint8(stylesXml());
  const ssData = strToUint8(ssXml());
  const wbData = strToUint8(workbookXml());
  const wbRelsData = strToUint8(workbookRels());

  const contentTypes = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const files: Record<string,Uint8Array> = {
    '[Content_Types].xml': strToUint8(contentTypes),
    '_rels/.rels': strToUint8(rootRels),
    'xl/workbook.xml': wbData,
    'xl/_rels/workbook.xml.rels': wbRelsData,
    'xl/styles.xml': stylesData,
    'xl/sharedStrings.xml': ssData,
  };
  sheets.forEach((_, i) => {
    files[`xl/worksheets/sheet${i+1}.xml`] = sheetXmls[i];
  });

  return new Blob([makeZip(files)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// ─── Función principal de exportación ────────────────────────────────────────
function exportShiftsToExcel(shifts: Shift[]): void {
  const xlSheets: XLSXSheet[] = [];
  xlSheets.push(makeSummarySheet(shifts));
  xlSheets.push(makeReferenceSheet());

  const empMap = new Map<number, { name: string; email: string; shifts: Shift[] }>();
  shifts.forEach(sh => {
    if (!empMap.has(sh.employee_id)) empMap.set(sh.employee_id, { name: sh.employee_name, email: sh.employee_email, shifts: [] });
    empMap.get(sh.employee_id)!.shifts.push(sh);
  });
  Array.from(empMap.entries())
    .sort((a, b) => a[1].name.localeCompare(b[1].name))
    .forEach(([, emp], i) => {
      xlSheets.push(makeEmployeeSheet(emp.name, emp.email, emp.shifts, TAB_COLORS[i % TAB_COLORS.length]));
    });

  const blob = buildXLSX(xlSheets);
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `Horarios_BoticasSanJose_${dateStr}.xlsx`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ─── Botón de exportación ─────────────────────────────────────────────────────
const ExportShiftsButton: React.FC<{ shifts: Shift[] }> = ({ shifts }) => {
  const [status, setStatus] = useState<'idle'|'loading'|'done'>('idle');
  const totalHoras = shifts.reduce((acc, sh) => acc + (SHIFT_HOURS[sh.shift_type] ?? 0), 0);
  const uniqueEmps = new Set(shifts.map(s => s.employee_id)).size;

  const handle = () => {
    if (status === 'loading') return;
    setStatus('loading');
    try {
      exportShiftsToExcel(shifts);
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
