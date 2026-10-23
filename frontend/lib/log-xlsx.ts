// Pembangun file Excel laporan log aktivitas (Task 35).
//
// Permintaan pemilik: hasil unduhan log harus "punya design yang bagus
// dan tertata rapih" — bukan CSV polos. Solusinya workbook .xlsx dengan:
//   Sheet "Ringkasan"  — judul, 5 KPI, 4 GRAFIK NATIVE Excel (bar Top
//                        Aksi, kurva tren periodik, doughnut tingkat,
//                        bar aktivitas per jam) + tabel datanya,
//   Sheet "Log"        — semua baris: header beku, autofilter, zebra
//                        banding, baris GAGAL disorot merah,
//   Sheet "Pivot Harian" — matriks tanggal × aksi untuk analisa lanjutan.
//
// Teknik chart: ExcelJS tidak mendukung chart, jadi XML chart OOXML
// (barChart/lineChart/doughnutChart + drawing anchor) dibangun manual
// lalu disuntikkan ke zip .xlsx lewat JSZip. Terverifikasi: openpyxl
// mendeteksi chart, LibreOffice me-render batang/garis/donut dengan
// data yang benar, dan Excel membukanya tanpa dialog repair.
import ExcelJS from "exceljs";
import JSZip from "jszip";
import {
  actionLabel,
  actionLevel,
  type LogLevel,
} from "@/lib/audit-labels";

// ---------- tipe publik ----------

export type LogRow = {
  createdAt: Date;
  actorName: string | null;
  actorRole: string | null;
  outletName: string | null;
  action: string;
  entity: string | null;
  summary: string;
};

export type LogExportMeta = {
  // "Semua outlet — akses developer" atau "Outlet: Warung Bu Ira".
  scope: string;
  // Rentang tanggal aktual dari baris yang diunduh.
  periode: string;
  // Deskripsi filter aktif, mis. "aksi=LOGIN_FAILED · tingkat=GAGAL".
  filterNote: string;
  generatedAt: Date;
};

// ---------- util ----------

const WIB_MS = 7 * 60 * 60 * 1000;

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const p2 = (n: number) => String(n).padStart(2, "0");

// Semua agregat & tampilan waktu memakai jam WIB: file dibaca pemilik
// warung, bukan mesin server.
function wibShifted(d: Date): Date {
  return new Date(d.getTime() + WIB_MS);
}

function wibStamp(d: Date): string {
  const t = wibShifted(d);
  return `${t.getUTCFullYear()}-${p2(t.getUTCMonth() + 1)}-${p2(t.getUTCDate())} ${p2(t.getUTCHours())}:${p2(t.getUTCMinutes())}:${p2(t.getUTCSeconds())}`;
}

function dayKey(d: Date): string {
  const t = wibShifted(d);
  return `${t.getUTCFullYear()}-${p2(t.getUTCMonth() + 1)}-${p2(t.getUTCDate())}`;
}

function dayLabel(key: string): string {
  const [y, m, d] = key.split("-");
  return `${d}/${m}/${y}`;
}

const MONTHS_ID = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  return `${MONTHS_ID[parseInt(m, 10) - 1]} ${y}`;
}

function addDays(key: string, days: number): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`;
}

function daysBetween(a: string, b: string): number {
  const ms = new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime();
  return Math.round(ms / 86_400_000);
}

// ---------- agregat ----------

type Aggregates = {
  total: number;
  topActions: { label: string; action: string; count: number }[];
  trend: { key: string; label: string; count: number }[];
  perHour: number[];
  levels: Record<LogLevel, number>;
  topActors: { name: string; count: number }[];
  uniqueActors: number;
  uniqueOutlets: number;
  pivotByDay: Map<string, Map<string, number>>;
  pivotActions: string[];
};

function aggregate(rows: LogRow[]): Aggregates {
  const total = rows.length;

  const byAction = new Map<string, number>();
  const byActor = new Map<string, number>();
  const byDay = new Map<string, Map<string, number>>();
  const perHour = new Array<number>(24).fill(0);
  const levels: Record<LogLevel, number> = {
    SUKSES: 0,
    PERINGATAN: 0,
    GAGAL: 0,
  };
  const outletSet = new Set<string>();
  const daySet = new Set<string>();

  for (const row of rows) {
    byAction.set(row.action, (byAction.get(row.action) ?? 0) + 1);
    if (row.actorName) {
      byActor.set(row.actorName, (byActor.get(row.actorName) ?? 0) + 1);
    }
    if (row.outletName) outletSet.add(row.outletName);

    const k = dayKey(row.createdAt);
    daySet.add(k);
    const dayMap = byDay.get(k) ?? new Map<string, number>();
    dayMap.set(row.action, (dayMap.get(row.action) ?? 0) + 1);
    byDay.set(k, dayMap);

    perHour[wibShifted(row.createdAt).getUTCHours()] += 1;
    levels[actionLevel(row.action)] += 1;
  }

  const topActions = [...byAction.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([action, count]) => ({
      label: actionLabel(action),
      action,
      count,
    }));

  const sortedDays = [...daySet].sort();
  let trend: { key: string; label: string; count: number }[] = [];

  if (sortedDays.length > 0) {
    const first = sortedDays[0];
    const last = sortedDays[sortedDays.length - 1];
    const span = daysBetween(first, last);
    if (span <= 92) {
      // Harian dengan hari kosong diisi 0 — kurva jujur (celah = tanpa
      // aktivitas, bukan garis yang menyambung dua minggu jauh).
      for (let k = first; ; k = addDays(k, 1)) {
        trend.push({
          key: k,
          label: dayLabel(k),
          count: (byDay.get(k)?.size ?? 0) === 0 ? 0 : sumDay(byDay.get(k)),
        });
        if (k === last) break;
      }
    } else {
      // Rentang panjang: agregasi bulanan agar kurva & tabel tetap terbaca.
      const byMonth = new Map<string, number>();
      for (const k of sortedDays) {
        const mk = k.slice(0, 7);
        byMonth.set(mk, (byMonth.get(mk) ?? 0) + sumDay(byDay.get(k)));
      }
      trend = [...byMonth.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([key, count]) => ({ key, label: monthLabel(key), count }));
    }
  }

  const topActors = [...byActor.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  // Kolom pivot: 12 aksi teratas + kategori "Lainnya".
  const pivotActions = [...byAction.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([action]) => action);

  return {
    total,
    topActions,
    trend,
    perHour,
    levels,
    topActors,
    uniqueActors: byActor.size,
    uniqueOutlets: outletSet.size,
    pivotByDay: byDay,
    pivotActions,
  };
}

function sumDay(dayMap: Map<string, number> | undefined): number {
  if (!dayMap) return 0;
  let sum = 0;
  for (const v of dayMap.values()) sum += v;
  return sum;
}

// ---------- XML chart (OOXML DrawingML) ----------

function strCache(ref: string, values: string[]): string {
  const pts = values
    .map((v, i) => `<c:pt idx="${i}"><c:v>${esc(v)}</c:v></c:pt>`)
    .join("");
  return `<c:strRef><c:f>${ref}</c:f><c:strCache><c:ptCount val="${values.length}"/>${pts}</c:strCache></c:strRef>`;
}

function numCache(ref: string, values: number[]): string {
  const pts = values
    .map((v, i) => `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`)
    .join("");
  return `<c:numRef><c:f>${ref}</c:f><c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${values.length}"/>${pts}</c:numCache></c:numRef>`;
}

function chartTitle(t: string): string {
  return `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1150" b="1"><a:solidFill><a:srgbClr val="1E293B"/></a:solidFill></a:defRPr></a:pPr><a:r><a:rPr lang="id-ID" sz="1150" b="1"><a:solidFill><a:srgbClr val="1E293B"/></a:solidFill></a:rPr><a:t>${esc(t)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>`;
}

const AXES = `<c:catAx><c:axId val="111111111"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:tickLblPos val="nextTo"/><c:crossAx val="222222222"/></c:catAx><c:valAx><c:axId val="222222222"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:majorGridlines/><c:numFmt formatCode="General" sourceLinked="1"/><c:tickLblPos val="nextTo"/><c:crossAx val="111111111"/></c:valAx>`;

function barChartXml(o: {
  title: string;
  seriesName: string;
  seriesNameRef: string;
  catRef: string;
  cats: string[];
  valRef: string;
  vals: number[];
  color: string;
}): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><c:roundedCorners val="0"/><c:chart>${chartTitle(o.title)}<c:autoTitleDeleted val="0"/><c:plotArea><c:layout/><c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:varyColors val="0"/><c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:strRef><c:f>${o.seriesNameRef}</c:f><c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>${esc(o.seriesName)}</c:v></c:pt></c:strCache></c:strRef></c:tx><c:spPr><a:solidFill><a:srgbClr val="${o.color}"/></a:solidFill><a:ln><a:noFill/></a:ln></c:spPr><c:cat>${strCache(o.catRef, o.cats)}</c:cat><c:val>${numCache(o.valRef, o.vals)}</c:val></c:ser><c:gapWidth val="60"/><c:axId val="111111111"/><c:axId val="222222222"/></c:barChart>${AXES}<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr></c:plotArea><c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart></c:chartSpace>`;
}

function lineChartXml(o: {
  title: string;
  seriesName: string;
  seriesNameRef: string;
  catRef: string;
  cats: string[];
  valRef: string;
  vals: number[];
  color: string;
}): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><c:roundedCorners val="0"/><c:chart>${chartTitle(o.title)}<c:autoTitleDeleted val="0"/><c:plotArea><c:layout/><c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/><c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:strRef><c:f>${o.seriesNameRef}</c:f><c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>${esc(o.seriesName)}</c:v></c:pt></c:strCache></c:strRef></c:tx><c:spPr><a:ln w="28575" cap="rnd"><a:solidFill><a:srgbClr val="${o.color}"/></a:solidFill><a:round/></a:ln></c:spPr><c:marker><c:symbol val="none"/></c:marker><c:cat>${strCache(o.catRef, o.cats)}</c:cat><c:val>${numCache(o.valRef, o.vals)}</c:val><c:smooth val="1"/></c:ser><c:marker val="0"/><c:axId val="111111111"/><c:axId val="222222222"/></c:lineChart>${AXES}<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr></c:plotArea><c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart></c:chartSpace>`;
}

function doughnutChartXml(o: {
  title: string;
  seriesName: string;
  seriesNameRef: string;
  catRef: string;
  cats: string[];
  valRef: string;
  vals: number[];
  colors: string[];
}): string {
  const dpts = o.colors
    .map(
      (c, i) =>
        `<c:dPt><c:idx val="${i}"/><c:bubble3D val="0"/><c:spPr><a:solidFill><a:srgbClr val="${c}"/></a:solidFill><a:ln><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:ln></c:spPr></c:dPt>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><c:roundedCorners val="0"/><c:chart>${chartTitle(o.title)}<c:autoTitleDeleted val="0"/><c:plotArea><c:layout/><c:doughnutChart><c:varyColors val="0"/><c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:strRef><c:f>${o.seriesNameRef}</c:f><c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>${esc(o.seriesName)}</c:v></c:pt></c:strCache></c:strRef></c:tx>${dpts}<c:cat>${strCache(o.catRef, o.cats)}</c:cat><c:val>${numCache(o.valRef, o.vals)}</c:val></c:ser><c:firstSliceAng val="0"/><c:holeSize val="58"/></c:doughnutChart><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr></c:plotArea><c:legend><c:legendPos val="r"/><c:overlay val="0"/></c:legend><c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart></c:chartSpace>`;
}

function twoCellAnchor(
  id: number,
  name: string,
  rid: string,
  from: { col: number; row: number },
  to: { col: number; row: number },
): string {
  return `<xdr:twoCellAnchor><xdr:from><xdr:col>${from.col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${from.row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>${to.col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${to.row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${id}" name="${esc(name)}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="${rid}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`;
}

type ChartSpec = {
  xml: string;
  from: { col: number; row: number };
  to: { col: number; row: number };
};

// Suntikkan chart ke zip .xlsx hasil ExcelJS. Target sheet harus sheet
// PERTAMA yang ditambahkan (file "sheet1.xml") — pembuat workbook di
// file ini selalu menambahkan "Ringkasan" lebih dulu.
async function injectCharts(
  buffer: ExcelJS.Buffer,
  sheetXmlName: string,
  charts: ChartSpec[],
): Promise<Buffer> {
  const zip = await JSZip.loadAsync(buffer as unknown as Uint8Array);

  // 1) [Content_Types].xml — daftarkan tiap chart + drawing.
  const ctFile = zip.file("[Content_Types].xml");
  if (!ctFile) throw new Error("[Content_Types].xml tidak ditemukan");
  const ct = await ctFile.async("string");
  const overrides =
    charts
      .map(
        (_, i) =>
          `<Override PartName="/xl/charts/chart${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`,
      )
      .join("") +
    `<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`;
  zip.file(
    "[Content_Types].xml",
    ct.replace("</Types>", `${overrides}</Types>`),
  );

  // 2) Part XML chart.
  charts.forEach((c, i) => {
    zip.file(`xl/charts/chart${i + 1}.xml`, c.xml);
  });

  // 3) Drawing (anchor chart di sheet) + rels-nya.
  const anchors = charts
    .map((c, i) =>
      twoCellAnchor(i + 2, `Chart ${i + 1}`, `rId${i + 1}`, c.from, c.to),
    )
    .join("");
  zip.file(
    "xl/drawings/drawing1.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">${anchors}</xdr:wsDr>`,
  );
  zip.file(
    "xl/drawings/_rels/drawing1.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${charts
      .map(
        (_, i) =>
          `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart${i + 1}.xml"/>`,
      )
      .join("")}</Relationships>`,
  );

  // 4) Relasi sheet target -> drawing. Sheet Ringkasan tidak punya
  //    hyperlink/gambar, jadi file rels-nya belum ada — dibuat baru.
  zip.file(
    `xl/worksheets/_rels/${sheetXmlName}.rels`,
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdDrw1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>`,
  );

  // 5) Sisipkan <drawing/> ke XML sheet (urutan skema worksheet:
  //    ...pageSetup/headerFooter lalu drawing — menaruh paling akhir
  //    sebelum </worksheet> aman untuk output ExcelJS).
  const sheetPath = `xl/worksheets/${sheetXmlName}`;
  const sheetFile = zip.file(sheetPath);
  if (!sheetFile) throw new Error(`${sheetPath} tidak ditemukan`);
  const sheetXml = await sheetFile.async("string");
  zip.file(
    sheetPath,
    sheetXml.replace(
      "</worksheet>",
      `<drawing xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rIdDrw1"/></worksheet>`,
    ),
  );

  const out = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
  });
  return out as unknown as Buffer;
}

// ---------- styling helpers ----------

const VIOLET = "FF7C3AED";
const VIOLET_DARK = "FF4C1D95";
const SLATE_900 = "FF0F172A";
const SLATE_600 = "FF475569";
const SLATE_400 = "FF94A3B8";
const SLATE_100 = "FFF1F5F9";
const SLATE_50 = "FFF8FAFC";
const RED_SOFT = "FFFEF2F2";
const AMBER_SOFT = "FFFFFBEB";

function headerCell(cell: ExcelJS.Cell): void {
  cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: VIOLET },
  };
  cell.alignment = {
    vertical: "middle",
    horizontal: "center",
    wrapText: true,
  };
}

function tableHeaderRow(
  ws: ExcelJS.Worksheet,
  rowNumber: number,
  values: (string | number)[],
): void {
  const row = ws.getRow(rowNumber);
  row.values = values;
  row.height = 20;
  row.eachCell({ includeEmpty: true }, (cell) => headerCell(cell));
}

function sectionTitle(
  ws: ExcelJS.Worksheet,
  rowNumber: number,
  text: string,
  colSpan: number,
): void {
  const row = ws.getRow(rowNumber);
  row.getCell(1).value = text;
  row.getCell(1).font = { bold: true, size: 12, color: { argb: VIOLET_DARK } };
  ws.mergeCells(rowNumber, 1, rowNumber, colSpan);
}

// ---------- workbook utama ----------

export async function buildLogWorkbook(
  rows: LogRow[],
  meta: LogExportMeta,
): Promise<Buffer> {
  const agg = aggregate(rows);
  const hasData = agg.total > 0;

  const wb = new ExcelJS.Workbook();
  wb.creator = "UMKM OS";
  wb.created = meta.generatedAt;

  // ============ Sheet 1: Ringkasan ============
  const ws = wb.addWorksheet("Ringkasan", {
    views: [{ showGridLines: false }],
  });
  ws.columns = [
    { width: 32 }, // A
    { width: 12 }, // B
    { width: 3 }, // C spacer
    { width: 16 }, // D
    { width: 12 }, // E
    { width: 3 }, // F spacer
    { width: 16 }, // G
    { width: 12 }, // H
    { width: 3 }, // I spacer
    { width: 18 }, // J
    { width: 12 }, // K
    { width: 3 }, // L spacer
    { width: 28 }, // M
    { width: 12 }, // N
  ];

  // Judul + subjudul.
  ws.getRow(1).height = 30;
  const titleCell = ws.getCell("A1");
  titleCell.value = "UMKM OS — Laporan Log Aktivitas";
  titleCell.font = { bold: true, size: 18, color: { argb: VIOLET_DARK } };
  ws.mergeCells("A1:N1");

  ws.getCell("A2").value = `${meta.scope} · ${meta.periode}`;
  ws.getCell("A2").font = { size: 11, color: { argb: SLATE_600 } };
  ws.mergeCells("A2:N2");

  ws.getCell("A3").value = `${meta.filterNote} · dibuat ${wibStamp(meta.generatedAt)} WIB (zona Jakarta) · ${agg.total} baris`;
  ws.getCell("A3").font = { size: 10, color: { argb: SLATE_400 } };
  ws.mergeCells("A3:N3");

  // --- KPI band (baris 5-6), 5 kotak 2 kolom ---
  const kpis: {
    label: string;
    value: string;
    fill: string;
    valueColor: string;
  }[] = [
    {
      label: "TOTAL EVENT",
      value: String(agg.total),
      fill: SLATE_50,
      valueColor: SLATE_900,
    },
    {
      label: hasData && agg.trend.length > 1 ? "PERIODE (HARI)" : "PERIODE",
      value: String(agg.trend.length),
      fill: SLATE_50,
      valueColor: SLATE_900,
    },
    {
      label: "AKTOR UNIK",
      value: String(agg.uniqueActors),
      fill: SLATE_50,
      valueColor: SLATE_900,
    },
    {
      label: "PERINGATAN",
      value: String(agg.levels.PERINGATAN),
      fill: agg.levels.PERINGATAN > 0 ? AMBER_SOFT : SLATE_50,
      valueColor: agg.levels.PERINGATAN > 0 ? "FFB45309" : SLATE_900,
    },
    {
      label: "GAGAL",
      value: String(agg.levels.GAGAL),
      fill: agg.levels.GAGAL > 0 ? RED_SOFT : SLATE_50,
      valueColor: agg.levels.GAGAL > 0 ? "FFB91C1C" : SLATE_900,
    },
  ];

  const kpiColStarts = [1, 4, 7, 10, 13]; // A, D, G, J, M
  kpis.forEach((kpi, i) => {
    const c1 = kpiColStarts[i];
    const c2 = c1 + 1;
    const labelCell = ws.getRow(5).getCell(c1);
    labelCell.value = kpi.label;
    labelCell.font = { bold: true, size: 9, color: { argb: SLATE_600 } };
    labelCell.alignment = { horizontal: "center" };
    labelCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: kpi.fill },
    };
    ws.getRow(5).getCell(c2).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: kpi.fill },
    };
    ws.mergeCells(5, c1, 5, c2);

    const valueCell = ws.getRow(6).getCell(c1);
    valueCell.value = kpi.value;
    valueCell.font = { bold: true, size: 16, color: { argb: kpi.valueColor } };
    valueCell.alignment = { horizontal: "center" };
    valueCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: kpi.fill },
    };
    ws.getRow(6).getCell(c2).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: kpi.fill },
    };
    ws.mergeCells(6, c1, 6, c2);
    ws.getRow(6).height = 24;
  });

  // Tinggi baris area chart (baris 8..40 1-based) supaya grafik ~320px.
  for (let r = 8; r <= 40; r++) {
    ws.getRow(r).height = 20;
  }

  // --- Tabel data sumber grafik (mulai baris 43) ---
  const DATA_START = 43;

  sectionTitle(ws, 42, "Data Analisa — sumber angka grafik di atas", 14);

  tableHeaderRow(ws, DATA_START, ["Top Aksi", "Jumlah"]);
  agg.topActions.forEach((a, i) => {
    const r = DATA_START + 1 + i;
    ws.getRow(r).getCell(1).value = a.label;
    ws.getRow(r).getCell(2).value = a.count;
    ws.getRow(r).getCell(2).alignment = { horizontal: "right" };
  });

  // Tabel "Periode" di kolom D:E — header ditulis sel per sel karena
  // tabel lain berbagi baris yang sama di kolom berbeda.
  ws.getRow(DATA_START).getCell(4).value = "Periode";
  ws.getRow(DATA_START).getCell(5).value = "Jumlah";
  headerCell(ws.getRow(DATA_START).getCell(4));
  headerCell(ws.getRow(DATA_START).getCell(5));
  agg.trend.forEach((t, i) => {
    const r = DATA_START + 1 + i;
    ws.getRow(r).getCell(4).value = t.label;
    ws.getRow(r).getCell(5).value = t.count;
    ws.getRow(r).getCell(5).alignment = { horizontal: "right" };
  });

  // Per jam: SELALU 24 baris (00:00-23:00) supaya referensi chart konstan.
  ws.getRow(DATA_START).getCell(7).value = "Jam (WIB)";
  ws.getRow(DATA_START).getCell(8).value = "Jumlah";
  headerCell(ws.getRow(DATA_START).getCell(7));
  headerCell(ws.getRow(DATA_START).getCell(8));
  for (let h = 0; h < 24; h++) {
    const r = DATA_START + 1 + h;
    ws.getRow(r).getCell(7).value = `${p2(h)}:00`;
    ws.getRow(r).getCell(8).value = agg.perHour[h];
    ws.getRow(r).getCell(8).alignment = { horizontal: "right" };
  }

  // Tingkat: selalu 3 baris.
  ws.getRow(DATA_START).getCell(10).value = "Tingkat";
  ws.getRow(DATA_START).getCell(11).value = "Jumlah";
  headerCell(ws.getRow(DATA_START).getCell(10));
  headerCell(ws.getRow(DATA_START).getCell(11));
  const levelRows: LogLevel[] = ["SUKSES", "PERINGATAN", "GAGAL"];
  levelRows.forEach((lvl, i) => {
    const r = DATA_START + 1 + i;
    ws.getRow(r).getCell(10).value = lvl;
    ws.getRow(r).getCell(11).value = agg.levels[lvl];
    ws.getRow(r).getCell(11).alignment = { horizontal: "right" };
  });

  // Top aktor.
  ws.getRow(DATA_START).getCell(13).value = "Aktor Teratas";
  ws.getRow(DATA_START).getCell(14).value = "Jumlah";
  headerCell(ws.getRow(DATA_START).getCell(13));
  headerCell(ws.getRow(DATA_START).getCell(14));
  agg.topActors.forEach((a, i) => {
    const r = DATA_START + 1 + i;
    ws.getRow(r).getCell(13).value = a.name;
    ws.getRow(r).getCell(14).value = a.count;
    ws.getRow(r).getCell(14).alignment = { horizontal: "right" };
  });

  if (!hasData) {
    ws.getRow(DATA_START + 26).getCell(1).value =
      "Tidak ada baris log pada rentang/filter ini — grafik dilewati. Longgarkan filter di halaman log lalu unduh ulang.";
    ws.getRow(DATA_START + 26).getCell(1).font = {
      italic: true,
      color: { argb: SLATE_600 },
    };
    ws.mergeCells(DATA_START + 26, 1, DATA_START + 26, 14);
  }

  // ============ Sheet 2: Log (semua baris) ============
  const logSheet = wb.addWorksheet("Log");
  logSheet.columns = [
    { width: 7 }, // No
    { width: 20 }, // Waktu WIB
    { width: 24 }, // Aktor
    { width: 12 }, // Peran
    { width: 22 }, // Outlet
    { width: 26 }, // Aksi (kode)
    { width: 28 }, // Deskripsi (label)
    { width: 14 }, // Tingkat
    { width: 30 }, // Entitas
    { width: 64 }, // Ringkasan
  ];
  tableHeaderRow(logSheet, 1, [
    "No",
    "Waktu (WIB)",
    "Aktor",
    "Peran",
    "Outlet",
    "Aksi",
    "Deskripsi",
    "Tingkat",
    "Entitas",
    "Ringkasan",
  ]);
  logSheet.getRow(1).height = 26;
  logSheet.views = [{ state: "frozen", ySplit: 1 }];
  logSheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: 10 },
  };

  // Styling per baris: zebra banding + sorotan GAGAL. Untuk file sangat
  // besar (>3000 baris) banding dilewati — waktu generate tetap cepat.
  const banding = rows.length <= 3000;
  rows.forEach((row, i) => {
    const r = i + 2;
    const lvl = actionLevel(row.action);
    const excelRow = logSheet.getRow(r);
    excelRow.values = [
      i + 1,
      wibStamp(row.createdAt),
      row.actorName ?? "Sistem",
      row.actorRole ?? "",
      row.outletName ?? "",
      row.action,
      actionLabel(row.action),
      lvl,
      row.entity ?? "",
      row.summary,
    ];
    // Kolom aksi & entitas pakai font mono supaya kode terbaca sebagai kode.
    excelRow.getCell(6).font = { name: "Consolas", size: 10 };
    excelRow.getCell(9).font = { name: "Consolas", size: 10 };
    excelRow.getCell(10).alignment = { wrapText: true, vertical: "top" };
    excelRow.getCell(2).alignment = { vertical: "top" };

    if (lvl === "GAGAL") {
      for (let c = 1; c <= 10; c++) {
        excelRow.getCell(c).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: RED_SOFT },
        };
      }
      excelRow.getCell(8).font = {
        bold: true,
        color: { argb: "FFB91C1C" },
      };
    } else {
      if (lvl === "PERINGATAN") {
        excelRow.getCell(8).font = { bold: true, color: { argb: "FFB45309" } };
        excelRow.getCell(8).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: AMBER_SOFT },
        };
      } else {
        excelRow.getCell(8).font = {
          color: { argb: "FF047857" },
        };
      }
      if (banding && i % 2 === 1) {
        for (let c = 1; c <= 10; c++) {
          excelRow.getCell(c).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: SLATE_100 },
          };
        }
        // Warna tingkat harus tetap terlihat di atas banding.
        if (lvl === "PERINGATAN") {
          excelRow.getCell(8).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: AMBER_SOFT },
          };
        }
      }
    }
  });

  // ============ Sheet 3: Pivot Harian ============
  const pivot = wb.addWorksheet("Pivot Harian");
  const pivotHeader = ["Tanggal", ...agg.pivotActions.map(actionLabel)];
  tableHeaderRow(pivot, 1, pivotHeader);
  pivot.views = [{ state: "frozen", ySplit: 1, xSplit: 1 }];
  pivot.getColumn(1).width = 14;
  for (let c = 2; c <= pivotHeader.length; c++) {
    pivot.getColumn(c).width = 16;
  }

  const dayKeys = [...agg.pivotByDay.keys()].sort();
  const otherActions = new Set(
    [...agg.pivotByDay.values()]
      .flatMap((m) => [...m.keys()])
      .filter((a) => !agg.pivotActions.includes(a)),
  );
  const pivotColCount = pivotHeader.length + (otherActions.size > 0 ? 1 : 0);
  const grandTotals = new Array<number>(pivotColCount).fill(0);

  dayKeys.forEach((k, ri) => {
    const r = ri + 2;
    const dayMap = agg.pivotByDay.get(k) ?? new Map<string, number>();
    const values: (string | number)[] = [dayLabel(k)];
    for (let ci = 0; ci < agg.pivotActions.length; ci++) {
      const n = dayMap.get(agg.pivotActions[ci]) ?? 0;
      values.push(n);
      grandTotals[ci + 1] += n;
    }
    if (otherActions.size > 0) {
      let n = 0;
      for (const a of otherActions) n += dayMap.get(a) ?? 0;
      values.push(n);
      grandTotals[grandTotals.length - 1] += n;
    }
    const excelRow = pivot.getRow(r);
    excelRow.values = values;
    for (let c = 2; c <= values.length; c++) {
      excelRow.getCell(c).alignment = { horizontal: "right" };
    }
    if (ri % 2 === 1) {
      for (let c = 1; c <= values.length; c++) {
        excelRow.getCell(c).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: SLATE_50 },
        };
      }
    }
  });

  if (dayKeys.length > 0) {
    const totalRow = pivot.getRow(dayKeys.length + 2);
    const totalValues: (string | number)[] = ["Total", ...grandTotals.slice(1)];
    if (otherActions.size > 0) {
      totalValues.push(grandTotals[grandTotals.length - 1]);
    }
    totalRow.values = totalValues;
    for (let c = 1; c <= totalValues.length; c++) {
      const cell = totalRow.getCell(c);
      cell.font = { bold: true };
      cell.border = { top: { style: "thin", color: { argb: SLATE_600 } } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: SLATE_100 },
      };
      if (c > 1) cell.alignment = { horizontal: "right" };
    }
  }

  // ============ Grafik + injeksi ============
  const buffer = await wb.xlsx.writeBuffer();

  if (!hasData) {
    // Tanpa data, referensi range kosong membuat chart rusak — dilewati.
    return buffer as unknown as Buffer;
  }

  const n = agg.topActions.length;
  const t = agg.trend.length;
  const charts: ChartSpec[] = [
    {
      xml: barChartXml({
        title: "Top Aksi — paling sering terjadi",
        seriesName: "Jumlah event",
        seriesNameRef: "Ringkasan!$B$43",
        catRef: `Ringkasan!$A$44:$A$${43 + n}`,
        cats: agg.topActions.map((a) => a.label),
        valRef: `Ringkasan!$B$44:$B$${43 + n}`,
        vals: agg.topActions.map((a) => a.count),
        color: "7C3AED",
      }),
      from: { col: 0, row: 7 },
      to: { col: 5, row: 22 },
    },
    {
      xml: lineChartXml({
        title: t > 1 ? "Kurva Tren Aktivitas per Periode" : "Aktivitas Periode Ini",
        seriesName: "Event per periode",
        seriesNameRef: "Ringkasan!$E$43",
        catRef: `Ringkasan!$D$44:$D$${43 + t}`,
        cats: agg.trend.map((x) => x.label),
        valRef: `Ringkasan!$E$44:$E$${43 + t}`,
        vals: agg.trend.map((x) => x.count),
        color: "2563EB",
      }),
      from: { col: 6, row: 7 },
      to: { col: 11, row: 22 },
    },
    {
      xml: doughnutChartXml({
        title: "Distribusi Tingkat — ada error atau tidak",
        seriesName: "Jumlah event",
        seriesNameRef: "Ringkasan!$K$43",
        catRef: "Ringkasan!$J$44:$J$46",
        cats: levelRows,
        valRef: "Ringkasan!$K$44:$K$46",
        vals: levelRows.map((l) => agg.levels[l]),
        colors: ["10B981", "F59E0B", "EF4444"],
      }),
      from: { col: 0, row: 24 },
      to: { col: 4, row: 39 },
    },
    {
      xml: barChartXml({
        title: "Aktivitas per Jam (WIB) — akumulatif periode",
        seriesName: "Jumlah event",
        seriesNameRef: "Ringkasan!$H$43",
        catRef: "Ringkasan!$G$44:$G$67",
        cats: agg.perHour.map((_, h) => `${p2(h)}:00`),
        valRef: "Ringkasan!$H$44:$H$67",
        vals: agg.perHour,
        color: "0EA5E9",
      }),
      from: { col: 6, row: 24 },
      to: { col: 11, row: 39 },
    },
  ];

  return injectCharts(buffer, "sheet1.xml", charts);
}
