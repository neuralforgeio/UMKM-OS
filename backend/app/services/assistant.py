"""Otak murni Asisten AI UMKM (ml-service v3.2.0) — blueprint BAB 6.5.

Modul ini 100% murni (tanpa DB, tanpa FastAPI, tanpa jaringan) supaya
bisa diuji penuh dengan stub ber-oracle. Ia menjalankan pseudocode 5
blueprint:

  1. classify_intent   — identitas | kemampuan | sapaan | terima_kasih |
                         penjualan | stok | produk | prediksi |
                         saran_tindakan
  2. extract_period    — hari | minggu | bulan
  3. build_messages    — system prompt tegas + RIWAYAT maks 5 pesan
  4. validate_numbers  — angka jawaban harus bisa dijelaskan DATA
                         (eksak | toleransi 2% | pembulatan GRID 2,5%);
                         gagal -> 1 kali retry koreksi
  5. build_offline_answer — Mode Data: jawaban dari template per-maksud

v3.2.0 "Asisten Cerdas" (jawab keluhan "jawabannya itu-itu saja"):
  - normalize_text meratakan bahasa informal Indonesia (slang, singkatan,
    gabungan kata) sebelum pencarian maksud;
  - taksonomi maksud diperluas: identitas ("nama mu siapa"), kemampuan
    ("bisa apa"), sapaan ("halo"), terima kasih, prediksi ("omzet besok",
    "ramalan minggu depan") — semuanya kini dijawab spesifik, bukan
    ringkasan template;
  - pencocokan kata kunci kini typo-toleran (difflib) untuk frasa panjang;
  - build_offline_answer menerima (intent, period) dan membangun jawaban
    yang BERBEDA per maksud + periode — pertanyaan berbeda tidak lagi
    menghasilkan jawaban kembar;
  - persona "Dea" konsisten di Mode Data maupun system prompt LLM.

Bentuk `context` (dibangun oleh routes/assistant.py dari SQL baca-saja):

  {
    "outlet": "Warung Sari",
    "penjualan": {
      "hari_ini":        {"omzet": 125000, "transaksi": 5},
      "kemarin":         {"omzet": 98000,  "transaksi": 4},
      "tujuh_hari":      {"omzet": 720000, "transaksi": 31},
      "tiga_puluh_hari": {"omzet": 3100000,"transaksi": 133},
    },
    "perubahan_mingguan_pct": 12.5,
    "produk_top":  [{"nama": "Kopi Susu", "qty": 12, "omzet": 60000}],
    "stok_kritis": [{"nama": "Gula", "stok": 2, "min_stok": 5,
                     "saran_restok": 3}],
    "prediksi":    {"tersedia": True, "engine": "prophet", "mape": 8.4},
    "ml_progress": {"hari_pendapatan": 2, "gerbang_pendapatan": 14, ...},
  }

Semua fungsi angka memakai format Indonesia: titik = ribuan, koma =
desimal ("Rp 1.250.000", "1,5 juta", "250rb").
"""

from __future__ import annotations

import difflib
import re
from typing import Any, Iterable, Protocol

# Batas blueprint: jawaban ringkas, murah, dan jelas untuk pemilik warung.
MAX_ANSWER_WORDS = 120
# Riwayat yang dikirim ke LLM: cukup untuk konteks, hemat token.
HISTORY_TURNS = 5
# Parameter generasi blueprint BAB 6.5 (deterministik, bukan kreatif).
TEMPERATURE = 0.2
MAX_TOKENS = 400

INTENTS = (
    "identitas", "kemampuan", "sapaan", "terima_kasih",
    "penjualan", "stok", "produk", "prediksi", "saran_tindakan",
)
PERIODS = ("hari", "minggu", "bulan")

# Pembulatan yang dianggap JUJU: Rp 1.250.000 untuk data 1.252.340 masih
# sah karena manusia warung bilang "sekitar satu dua lima". GRID berisi
# kelipatan 5/10/25/50 hingga 10 juta.
ROUNDING_GRID = (
    5, 10, 25, 50, 100, 250, 500, 1_000, 2_500, 5_000, 10_000, 25_000,
    50_000, 100_000, 250_000, 500_000, 1_000_000, 2_500_000, 5_000_000,
    10_000_000,
)
TOLERANCE_REL = 0.02       # 2% — selisih kecil dari redaksi LLM
ROUNDING_TOLERANCE_REL = 0.025  # 2,5% — selisih akibat pembulatan GRID

# Nama persona asisten — konsisten di Mode Data & system prompt LLM.
ASSISTANT_NAME = "Dea"


# ----------------------------------------------------------------------
# 0) Normalisasi bahasa informal Indonesia (v3.2.0)
# ----------------------------------------------------------------------
# Gabungan kata yang harus dipecah SEBELUM pemecahan kata.
_GABUNGAN = {
    "namamu": "nama kamu",
    "siapakamu": "siapa kamu",
    "siapanama": "siapa nama",
    "terimakasih": "terima kasih",
    "terimakasihya": "terima kasih ya",
    "namanya": "nama dia",
    "kamusiapa": "kamu siapa",
}

# Singkatan & slang per KATA (kata hasil pemetaan boleh berisi spasi —
# token dipecah ulang setelahnya). Semua kunci/nilai huruf kecil.
_SLANK = {
    "gmn": "gimana", "gimana": "gimana", "gk": "tidak", "ga": "tidak",
    "gak": "tidak", "nggak": "tidak", "enggak": "tidak", "gg": "tidak",
    "yg": "yang", "udh": "sudah", "sdh": "sudah", "udah": "sudah",
    "blm": "belum", "bsk": "besok", "skrg": "sekarang", "skg": "sekarang",
    "brp": "berapa", "brapa": "berapa", "mu": "kamu", "lo": "kamu",
    "lu": "kamu", "km": "kamu", "kmu": "kamu", "elu": "kamu",
    "utk": "untuk", "dgn": "dengan", "dg": "dengan", "dpn": "depan",
    "kmrn": "kemarin", "kmren": "kemarin", "mng": "minggu",
    "bln": "bulan", "hr": "hari", "trx": "transaksi", "omset": "omzet",
    "thx": "terima kasih", "makasih": "terima kasih",
    "makasi": "terima kasih", "kamsia": "terima kasih",
    "tengkiu": "terima kasih", "plg": "paling", "dpt": "dapat",
    "mo": "mau", "pengen": "ingin", "pengin": "ingin", "aja": "saja",
    "sj": "saja", "kyk": "kayak", "klo": "kalau", "kalo": "kalau",
    "jgn": "jangan", "lbh": "lebih", "byk": "banyak", "bnyk": "banyak",
    "dikit": "sedikit", "sm": "sama", "bgt": "banget",
}


def normalize_text(question: str) -> str:
    """Ratakan pertanyaan ke bentuk baku pencarian maksud.

    Urutan: huruf kecil -> buang tanda baca -> pecah gabungan kata ->
    petakan slang per kata -> lipat spasi. Contoh:
      "Nama mu siapa??"        -> "nama kamu siapa"
      "omzet gmn?"             -> "omzet gimana"
      "saran minggu dpn dong"  -> "saran minggu depan dong"
    """
    t = (question or "").lower()
    t = re.sub(r"[^a-z0-9]+", " ", t)
    t = f" {t.strip()} "
    for asal, tujuan in _GABUNGAN.items():
        t = t.replace(f" {asal} ", f" {tujuan} ")
    kata = [
        bagian
        for token in t.split()
        for bagian in _SLANK.get(token, token).split()
    ]
    return " ".join(kata).strip()


# ----------------------------------------------------------------------
# 1) Klasifikasi maksud & ekstraksi waktu
# ----------------------------------------------------------------------
# Urutan pengecekan (yang pertama menang):
#   saran -> stok -> produk -> penjualan(+masa-depan => prediksi) ->
#   prediksi eksplisit -> identitas -> kemampuan -> sapaan ->
#   terima kasih -> default saran_tindakan.
# Kata data diperiksa LEBIH DULU daripada basa-basi supaya "halo, omzet
# berapa?" tetap dijawab data (bukan sekadar balas sapaan).
_KW_SARAN = (
    "saran", "sarankan", "rekomendasi", "rekomendasikan", "tips", "nasihat",
    "strategi", "harus apa", " harus ", "apa yang harus", "apa yang bisa",
    "gimana cara", "bagaimana cara", "apa selanjutnya", "maka apa",
    "kira kira harus", "solusi", "bagaimana agar",
)
_KW_STOK = (
    "stok", "stock", "sisa", "habis", "menipis", "kosong", "restok",
    "restock", "persediaan", "gudang", "inventaris", "beli lagi",
    "tambah barang",
)
_KW_PRODUK = (
    "produk", "barang", "item", "terlaris", "paling laku", "paling banyak",
    "populer", "best seller", "favorit", "kategori", "mana yang laku",
    "daftar menu", "menu apa", "andalan",
)
_KW_PENJUALAN = (
    "omzet", "pendapatan", "penjualan", "terjual", "jual",
    "uang masuk", "penghasilan", "revenue", "transaksi", "laba", "untung",
    "rugi", "hasil", "cuan",
)
# Penanda masa depan: memindah pertanyaan penjualan ke maksud prediksi.
_KW_MASA_DEPAN = (
    "besok", "nanti", " depan ", "akan datang", "mendatang", "masa depan",
    "berikutnya", "selanjutnya", "lusa",
)
_KW_PREDIKSI = (
    "prediksi", "ramal", "proyeksi", "forecast", "prognosis", "estimasi",
    "taksiran", "perkiraan",
)
_KW_IDENTITAS = (
    "siapa kamu", "kamu siapa", "nama kamu", "siapa nama", "nama asisten",
    "kenalan", "perkenalkan diri", "kamu robot", "kamu manusia", "kamu ai",
    "kamu aplikasi", "kamu ini siapa", "siapa yang menjawab",
    "dibuat oleh siapa", "nama dea",
)
_KW_KEMAMPUAN = (
    "bisa apa", "apa yang bisa", "bisa bantu apa", "fitur", "bantuan",
    "help", "cara pakai", "apa saja yang bisa", "kemampuan", "kegunaan",
    "buat apa", "fungsinya apa", "apa fungsi", "daftar perintah",
    "perintah apa", "contoh pertanyaan",
)
_KW_SAPAAN = (
    "halo", "hallo", "hai", "hei", "hello", "hi", "pagi", "siang",
    "sore", "malam", "assalamualaikum", "salam", "permisi", "oi",
    "halo dea", "p", "woi",
)
_KW_TERIMA_KASIH = (
    "terima kasih", "thanks", "thank you", "sip", "siip", "mantap", "top",
    "good job", "bagus deh", "oke deh", "ok deh", "nice", "keren",
)

_KW_HARI = (
    "hari ini", "kemarin", " tadi ", "harian", "per hari", "sehari",
    "hari kemarin", "kemarin",
)
_KW_MINGGU = (
    "minggu", "pekan", "7 hari", "tujuh hari", "seminggu", "sepekan",
)
_KW_BULAN = (
    "bulan", "30 hari", "tiga puluh hari", "sebulan", "bulanan",
    "bulan ini", "bulan lalu",
)


# Kata penghubung yang TIDAK dihitung saat pencocokan kabur — hanya
# kata pention (kata isi) yang harus punya pasangan mirip di pertanyaan.
_STOPWORD_FRASA = frozenset({
    "apa", "yang", "kamu", "saya", "untuk", "dengan", "hari", "ini",
    "itu", "dong", "ya", "sih", "deh", "kok",
})


def _mirip(toks: list[str], frasa: str) -> bool:
    """Pencocokan kabur TOKEN-LEVEL utk frasa >= 2 kata (typo-toleran).

    HANYA frasa berciri >= 2 KATA ISI yang boleh dicocokkan kabur —
    frasa ber-satu-kata-isi ("apa yang bisa" -> isi cuma "bisa") bukti
    terlalu tipis: "kamu bisa apa" akan tergiring ke saran padahal itu
    pertanyaan kemampuan. Setiap kata isi wajib punya pasangan token
    pertanyaan ber-kemiripan >= 0.8; kata penghubung diabaikan supaya
    "stok apa yang menipis" tidak dianggap mirip "apa yang harus".
    """
    kata = frasa.split()
    if len(kata) < 2 or len(frasa) < 8:
        return False
    isi = [k for k in kata if k not in _STOPWORD_FRASA]
    if len(isi) < 2:
        return False
    for k in isi:
        if not any(
            difflib.SequenceMatcher(None, k, t).ratio() >= 0.8 for t in toks
        ):
            return False
    return True


def _hit(text: str, keywords: Iterable[str]) -> bool:
    """Cocok eksak (substring ber-spasi pengaman) LALU kabur typo."""
    t = f" {text.lower()} "
    toks = t.split()
    for k in keywords:
        if k in t:
            return True
        if _mirip(toks, k.strip()):
            return True
    return False


def classify_intent(question: str) -> str:
    """Maksud pertanyaan — lihat INTENTS.

    Default = saran_tindakan: pertanyaan bebas ("gimana ya?") paling
    dijawab dengan ringkasan + saran, bukan ditolak. Pertanyaan data
    menang atas basa-basi ("halo, omzet berapa?" -> penjualan), dan
    penanda masa depan memindah pertanyaan penjualan ke prediksi
    ("berapa omzet besok" -> prediksi).
    """
    t = normalize_text(question)
    if _hit(t, _KW_SARAN):
        return "saran_tindakan"
    if _hit(t, _KW_STOK):
        return "stok"
    if _hit(t, _KW_PRODUK):
        return "produk"
    if _hit(t, _KW_PENJUALAN):
        return "prediksi" if _hit(t, _KW_MASA_DEPAN) else "penjualan"
    if _hit(t, _KW_PREDIKSI):
        return "prediksi"
    if _hit(t, _KW_IDENTITAS):
        return "identitas"
    if _hit(t, _KW_KEMAMPUAN):
        return "kemampuan"
    if _hit(t, _KW_SAPAAN):
        return "sapaan"
    if _hit(t, _KW_TERIMA_KASIH):
        return "terima_kasih"
    return "saran_tindakan"


def extract_period(question: str) -> str:
    """Periode yang DIMAKSUD penanya: hari | minggu | bulan (default hari)."""
    t = normalize_text(question)
    if _hit(t, _KW_BULAN):
        return "bulan"
    if _hit(t, _KW_MINGGU):
        return "minggu"
    return "hari"


# Pemindai angka bergaya Indonesia: opsional "Rp", deretan digit dengan
# pemisah titik/koma, opsional satuan (juta/rb), opsional "%".
_TOKEN_RE = re.compile(
    r"(?:[Rr][Pp]\.?\s*)?"
    r"(?P<angka>\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)"
    r"\s*(?P<satuan>(?:juta|jt|ribu|rb|k)\b)?"
    r"(?P<persen>\s*%)?"
)
_UNIT_MULT = {"juta": 1_000_000.0, "jt": 1_000_000.0,
              "ribu": 1_000.0, "rb": 1_000.0, "k": 1_000.0}


# ----------------------------------------------------------------------
# 2) Angka format Indonesia — ekstraksi & validasi
# ----------------------------------------------------------------------
def parse_number_id(token: str) -> float | None:
    """Parse satu token angka Indonesia -> float (None bila gagal).

    Aturan pemisah (konsisten bahasa Indonesia):
      - "1.250.000"  -> 1250000  (titik = ribuan)
      - "12,5"       -> 12.5     (koma = desimal)
      - "1.250.000,50" -> 1250000.5 (kedua pemisah: terakhir = desimal)
      - "1,250,000"  -> 1250000  (grup-3 berulang = ribuan)
      - "1.25"       -> 1.25     (titik tunggal pecahan < 3 digit:
                                   desimal gaya Inggris dari LLM)
    """
    t = token.strip().replace(" ", "")
    if not t or not re.search(r"\d", t):
        return None
    has_dot, has_comma = "." in t, "," in t
    if has_dot and has_comma:
        # Pemisah TERAKHIR = desimal; yang lain = ribuan.
        if t.rfind(",") > t.rfind("."):
            t = t.replace(".", "").replace(",", ".")
        else:
            t = t.replace(",", "")
    elif has_comma:
        groups = re.fullmatch(r"\d{1,3}(,\d{3})+", t)
        t = t.replace(",", "") if groups else t.replace(",", ".")
    elif has_dot:
        groups = re.fullmatch(r"\d{1,3}(\.\d{3})+", t)
        if groups:
            t = t.replace(".", "")  # "1.250.000" -> "1250000"
        else:
            head, _, tail = t.partition(".")
            # "1.25" -> desimal; "12.3456" tanpa satuan tak wajar -> ribuan.
            t = f"{head}.{tail}" if 0 < len(tail) < 3 else t.replace(".", "")
    try:
        return float(t)
    except ValueError:
        return None


def extract_numbers(text: str) -> list[tuple[float, bool, bool]]:
    """Semua angka dalam teks -> [(nilai, adalah_rp, adalah_persen)].

    Hanya angka BERISIKO halusinasi yang dilaporkan (Rp eksplisit, nilai
    >= 1000, atau persentase). Angka kecil ("1 saran", "2 produk") dan
    tahun 1900-2100 dilewati — terlalu umum untuk dipakai bukti.
    """
    hasil: list[tuple[float, bool, bool]] = []
    for m in _TOKEN_RE.finditer(text):
        nilai = parse_number_id(m.group("angka"))
        if nilai is None:
            continue
        satuan = (m.group("satuan") or "").lower()
        if satuan in _UNIT_MULT:
            nilai *= _UNIT_MULT[satuan]
        # "Rp" bisa menempel langsung ("Rp125") atau terpisah spasi
        # ("Rp 125") — lihat 3 karakter ke belakang dari awal token.
        prefiks = text[max(0, m.start() - 3):m.start()].lower()
        rp = "rp" in prefiks or bool(re.match(r"\s*[Rr][Pp]", text[m.start():]))
        persen = bool(m.group("persen"))
        if not rp and not persen and 1900 <= nilai <= 2100 and nilai.is_integer():
            continue  # tahun, bukan data bisnis
        hasil.append((nilai, rp, persen))
    return hasil


def _bisa_dijelaskan(nilai: float, sumber: float) -> bool:
    """Apakah `nilai` bisa dijelaskan oleh SATU angka DATA `sumber`?

    Eksak, atau selisih relatif <= 2%, atau pembulatan GRID dalam 2,5%
    (mis. jawaban "Rp 1.250.000" untuk data 1.252.340).
    """
    if nilai == sumber:
        return True
    patok = max(abs(sumber), 1.0)
    if abs(nilai - sumber) / patok <= TOLERANCE_REL:
        return True
    for g in ROUNDING_GRID:
        bulat = round(sumber / g) * g
        if abs(nilai - bulat) < 1e-9 and abs(nilai - sumber) / patok <= ROUNDING_TOLERANCE_REL:
            return True
    return False


def validate_numbers(
    answer: str, allowed: Iterable[float]
) -> tuple[bool, list[float]]:
    """(semua_sah, daftar_angka_mencurigakan).

    Sah = setiap angka berisiko di jawaban bisa dijelaskan >= 1 angka
    DATA. Persentase hanya diadu dengan angka DATA < 100 (pct, MAPE,
    stok kecil); nilai Rp/uang hanya diadu dengan angka DATA >= 100
    supaya "Rp 25" tidak lolos karena ada stok 25.
    """
    sumber = [float(s) for s in allowed]
    pelanggar: list[float] = []
    for nilai, rp, persen in extract_numbers(answer):
        if persen:
            # Persentase hanya diadu dengan angka DATA < 100 (pct, MAPE,
            # stok kecil). Bila DATA tidak punya angka sekecil itu,
            # persentase TIDAK bisa dijelaskan => pelanggar.
            kandidat = [s for s in sumber if abs(s) < 100]
        elif rp:
            # Uang hanya diadu dengan angka DATA >= 100 supaya "Rp 25"
            # tidak lolos hanya karena ada stok 25.
            kandidat = [s for s in sumber if abs(s) >= 100]
        else:
            kandidat = sumber
        if not any(_bisa_dijelaskan(nilai, s) for s in kandidat):
            pelanggar.append(nilai)
    return (not pelanggar, pelanggar)


def build_retry_instruction(offenders: list[float]) -> str:
    """Instruksi koreksi untuk retry ke-1 (satu-satunya) blueprint."""
    daftar = ", ".join(f"Rp {format_rupiah_id(v)}" for v in offenders)
    return (
        "Jawabanmu memuat angka yang TIDAK ada di DATA: "
        f"{daftar}. Tulis ulang jawabanmu HANYA memakai angka dari DATA "
        "di pesan sistem. Jangan menambahkan angka baru."
    )


def format_rupiah_id(nilai: float) -> str:
    """1_250_000.0 -> '1.250.000' (gaya Indonesia, tanpa awalan Rp)."""
    negatif = nilai < 0
    bulat = int(round(abs(nilai)))
    s = f"{bulat:,}".replace(",", ".")
    return f"-{s}" if negatif else s


def format_persen_id(nilai: float) -> str:
    """12.5 -> '12,5' (koma desimal Indonesia, tanpa tanda %)."""
    return f"{abs(nilai):.1f}".replace(".", ",")


# ----------------------------------------------------------------------
# 3) Kumpulan angka sah dari context
# ----------------------------------------------------------------------
def collect_allowed_numbers(context: dict[str, Any]) -> list[float]:
    """Semua angka DATA yang boleh muncul di jawaban (+ jendela waktu).

    Jendela 7/30 hari ikut diizinkan supaya frasa template ("7 hari
    terakhir") tidak salah bunyi. Boolean DIBUANG (bukan angka data).
    v3.2.0: ml_progress IKUT diizinkan — "14 hari" / "sudah 2 hari" di
    jawaban prediksi/saran adalah angka data gerbang, bukan karangan.
    """
    nilai: list[float] = [7.0, 30.0]

    def _susuri(node: Any) -> None:
        if isinstance(node, dict):
            for v in node.values():
                _susuri(v)
        elif isinstance(node, (list, tuple)):
            for v in node:
                _susuri(v)
        elif isinstance(node, bool):
            return
        elif isinstance(node, (int, float)):
            nilai.append(float(node))

    _susuri(context.get("penjualan", {}))
    _susuri(context.get("produk_top", []))
    _susuri(context.get("stok_kritis", []))
    progres = context.get("ml_progress") or {}
    if isinstance(progres, dict):
        for v in progres.values():
            if isinstance(v, bool) or not isinstance(v, (int, float)):
                continue
            nilai.append(float(v))
    prediksi = context.get("prediksi") or {}
    if isinstance(prediksi.get("mape"), (int, float)) and not isinstance(
        prediksi.get("mape"), bool
    ):
        nilai.append(float(prediksi["mape"]))
    if isinstance(context.get("perubahan_mingguan_pct"), (int, float)) and not isinstance(
        context.get("perubahan_mingguan_pct"), bool
    ):
        nilai.append(float(context["perubahan_mingguan_pct"]))
    return nilai


# ----------------------------------------------------------------------
# 4) Prompt & pesan LLM
# ----------------------------------------------------------------------
def _baris_penjualan(context: dict[str, Any]) -> list[str]:
    p = context.get("penjualan", {})

    def _fmt(blok: dict[str, Any] | None) -> str:
        if not blok:
            return "tidak ada data"
        return (
            f"Rp {format_rupiah_id(blok.get('omzet', 0))} "
            f"({blok.get('transaksi', 0)} transaksi)"
        )

    return [
        f"- Penjualan hari ini: {_fmt(p.get('hari_ini'))}",
        f"- Kemarin: {_fmt(p.get('kemarin'))}",
        f"- 7 hari terakhir: {_fmt(p.get('tujuh_hari'))}",
        f"- 30 hari terakhir: {_fmt(p.get('tiga_puluh_hari'))}",
    ]


def build_system_prompt(context: dict[str, Any]) -> str:
    """System prompt tegas blueprint BAB 6.5 + blok DATA terformat.

    v3.2.0: persona bernama + aturan identitas — pertanyaan "nama mu
    siapa / siapa kamu" dijawab perkenalan singkat lalu tawaran bantuan,
    bukan ringkasan data.
    """
    p = context.get("perubahan_mingguan_pct")
    tren = "tidak tersedia"
    if isinstance(p, (int, float)) and not isinstance(p, bool):
        tren = f"{'naik' if p >= 0 else 'turun'} {format_persen_id(p)}%"

    top = context.get("produk_top") or []
    baris_top = (
        "; ".join(
            f"{item.get('nama')} ({item.get('qty')} terjual, "
            f"Rp {format_rupiah_id(item.get('omzet', 0))})"
            for item in top[:5]
        )
        or "tidak ada penjualan"
    )
    kritis = context.get("stok_kritis") or []
    baris_stok = (
        "; ".join(
            f"{item.get('nama')} (sisa {item.get('stok')}, minimum "
            f"{item.get('min_stok')}, sarankan restok +{item.get('saran_restok')})"
            for item in kritis[:6]
        )
        or "tidak ada yang menipis"
    )
    prediksi = context.get("prediksi") or {}
    if prediksi.get("tersedia"):
        mape = prediksi.get("mape")
        mape_txt = (
            f", MAPE {mape:.1f}%".replace(".", ",")
            if isinstance(mape, (int, float)) and not isinstance(mape, bool)
            else ""
        )
        baris_prediksi = f"tersedia (engine {prediksi.get('engine')}{mape_txt})"
    else:
        baris_prediksi = "belum tersedia untuk outlet ini"

    progres = context.get("ml_progress") or {}
    baris_progres = ""
    if progres:
        baris_progres = (
            f"\n- Kemajuan data model ramalan: {progres.get('hari_pendapatan', 0)}"
            f" dari {progres.get('gerbang_pendapatan', 0)} hari ber-pendapatan"
            " (model dilatih otomatis begitu terpenuhi)"
        )

    return (
        f"Kamu adalah {ASSISTANT_NAME}, asisten bisnis warung UMKM Indonesia. "
        f"Jawab pemilik warung {context.get('outlet', '-')} dengan bahasa Indonesia "
        "sehari-hari yang hangat tapi ringkas.\n"
        "ATURAN WAJIB:\n"
        "1. Jawab HANYA dari DATA di bawah — DILARANG mengarang atau "
        "menebak angka.\n"
        f"2. Maksimal {MAX_ANSWER_WORDS} kata.\n"
        "3. Akhiri jawaban dengan TEPAT 1 saran tindakan konkret.\n"
        "4. Bila DATA tidak memuat jawabannya, katakan bagian mana yang "
        "tidak tersedia.\n"
        "5. Bila ditanya siapa kamu / nama mu, perkenalkan diri sebagai "
        f"{ASSISTANT_NAME} asisten warung, lalu tawarkan bantuan soal data.\n"
        "6. Format uang gaya Indonesia: Rp 1.250.000 (titik ribuan).\n"
        "DATA:\n"
        + "\n".join(_baris_penjualan(context))
        + f"\n- Perubahan omzet minggu ini vs minggu lalu: {tren}"
        + f"\n- Produk terlaris 7 hari: {baris_top}"
        + f"\n- Stok menipis: {baris_stok}"
        + f"\n- Ramalan 7 hari: {baris_prediksi}"
        + baris_progres
    )


def build_messages(
    context: dict[str, Any],
    history: list[dict[str, str]],
    question: str,
) -> list[dict[str, str]]:
    """[system, *riwayat(<=5), user] — bentuk pesan OpenAI-compatible."""
    riwayat = [
        {"role": m["role"], "content": m["content"]}
        for m in (history or [])[-HISTORY_TURNS:]
        if m.get("role") in ("USER", "user", "ASSISTANT", "assistant")
    ]
    return (
        [{"role": "system", "content": build_system_prompt(context)}]
        + riwayat
        + [{"role": "user", "content": question}]
    )


# ----------------------------------------------------------------------
# 5) Mode Data (offline) — jawaban per-maksud tanpa LLM (v3.2.0)
# ----------------------------------------------------------------------
def _pct_id(nilai: float) -> str:
    return format_persen_id(nilai)


def _top_pertama(context: dict[str, Any]) -> dict[str, Any] | None:
    top = context.get("produk_top") or []
    return top[0] if top else None


def _stok_pertama(context: dict[str, Any]) -> dict[str, Any] | None:
    kritis = context.get("stok_kritis") or []
    return kritis[0] if kritis else None


def _omzet(context: dict[str, Any], kunci: str) -> int:
    blok = (context.get("penjualan") or {}).get(kunci) or {}
    return int(blok.get("omzet", 0) or 0)


def _trx(context: dict[str, Any], kunci: str) -> int:
    blok = (context.get("penjualan") or {}).get(kunci) or {}
    return int(blok.get("transaksi", 0) or 0)


def _jawab_identitas(context: dict[str, Any]) -> str:
    outlet = context.get("outlet", "-")
    return (
        f"Saya {ASSISTANT_NAME}, asisten bisnis warung {outlet}. Saya membaca "
        f"catatan penjualan, stok, dan produk {outlet} langsung dari sistem, "
        "jadi setiap angka yang saya sebut nyata, bukan karangan. Coba tanya "
        "\"berapa omzet hari ini\", \"stok apa yang menipis\", atau "
        "\"saran minggu depan\". Saran: mulai dari omzet hari ini biar kebayang "
        "ramai-tidaknya warungmu."
    )


def _jawab_kemampuan(context: dict[str, Any]) -> str:
    outlet = context.get("outlet", "-")
    return (
        "Saya bisa: omzet hari ini / kemarin / 7 hari / 30 hari; produk "
        "terlaris; stok menipis plus saran restok; prediksi ramalan; dan "
        "saran tindakan untuk warungmu. Contoh: \"berapa omzet minggu ini?\", "
        "\"produk paling laku apa?\", \"saran minggu depan dong\". Semua angka "
        f"dari catatan {outlet} — kalau datanya belum ada, saya bilang apa "
        "adanya. Saran: coba satu contoh di atas sekarang."
    )


def _jawab_sapaan(context: dict[str, Any]) -> str:
    outlet = context.get("outlet", "-")
    omzet = _omzet(context, "hari_ini")
    trx = _trx(context, "hari_ini")
    if omzet > 0:
        return (
            f"Halo! Saya {ASSISTANT_NAME}, asisten warung {outlet}. Omzet hari "
            f"ini sudah Rp {format_rupiah_id(omzet)} dari {trx} transaksi. "
            "Mau tanya omzet, stok, produk, atau minta saran? Saran: kalau "
            "baru mulai hari, cek dulu stok yang menipis biar tidak kehabisan."
        )
    return (
        f"Halo! Saya {ASSISTANT_NAME}, asisten warung {outlet}. Hari ini belum "
        "ada penjualan tercatat. Mau tanya omzet, stok, produk, atau minta "
        "saran? Saran: pastikan transaksi hari dicatat lewat kasir supaya "
        "asisten dan ramalan makin pintar membaca warungmu."
    )


def _jawab_terima_kasih(context: dict[str, Any]) -> str:
    return (
        "Sama-sama! Kalau butuh angka omzet, kondisi stok, atau saran "
        "untuk warung, panggil saya lagi kapan saja. Saran: sebelum tutup "
        "warung, tanya sekali \"saran untuk besok\" biar besok lebih siap."
    )


def _jawab_penjualan(context: dict[str, Any], period: str) -> str:
    outlet = context.get("outlet", "-")
    if period == "minggu":
        bagian = [
            f"Omzet 7 hari terakhir Rp {format_rupiah_id(_omzet(context, 'tujuh_hari'))} "
            f"({_trx(context, 'tujuh_hari')} transaksi)."
        ]
        p = context.get("perubahan_mingguan_pct")
        if isinstance(p, (int, float)) and not isinstance(p, bool):
            arah = "naik" if p >= 0 else "turun"
            bagian.append(f"Itu {arah} {_pct_id(p)}% dibanding minggu sebelumnya.")
        else:
            bagian.append("Minggu sebelumnya belum ada data pembanding.")
    elif period == "bulan":
        bagian = [
            f"Omzet 30 hari terakhir Rp {format_rupiah_id(_omzet(context, 'tiga_puluh_hari'))} "
            f"({_trx(context, 'tiga_puluh_hari')} transaksi), sepekan terakhir "
            f"Rp {format_rupiah_id(_omzet(context, 'tujuh_hari'))} "
            f"({_trx(context, 'tujuh_hari')} transaksi)."
        ]
    else:
        hari = _omzet(context, "hari_ini")
        kemarin = _omzet(context, "kemarin")
        bagian = [
            f"Omzet hari ini Rp {format_rupiah_id(hari)} "
            f"({_trx(context, 'hari_ini')} transaksi), kemarin "
            f"Rp {format_rupiah_id(kemarin)} ({_trx(context, 'kemarin')} transaksi)"
        ]
        if kemarin > 0 and hari > kemarin:
            bagian.append("- sedikit lebih tinggi dari kemarin.")
        elif kemarin > 0 and hari < kemarin:
            bagian.append("- masih di bawah kemarin.")
        else:
            bagian.append(".")
        bagian.append(
            f"Sepekan terakhir Rp {format_rupiah_id(_omzet(context, 'tujuh_hari'))}."
        )
    top = _top_pertama(context)
    if top:
        bagian.append(
            f"Terlaris 7 hari: {top.get('nama')} ({top.get('qty')}x)."
        )
        bagian.append(
            f"Saran: jaga ketersediaan {top.get('nama')} — itu andalan omzet {outlet}."
        )
    else:
        bagian.append("Saran: catat penjualan lewat kasir supaya tren terbaca.")
    return " ".join(bagian)


def _jawab_produk(context: dict[str, Any]) -> str:
    top = context.get("produk_top") or []
    if not top:
        outlet = context.get("outlet", "-")
        return (
            f"Belum ada penjualan 7 hari terakhir di {outlet}, jadi daftar "
            "terlaris belum bisa dihitung. Daftar ini otomatis muncul setelah "
            "transaksi tercatat lewat kasir. Saran: jual dulu satu hari penuh, "
            "lalu tanya lagi — saya urutkan yang paling laku."
        )
    daftar = ", ".join(
        f"{item.get('nama')} {item.get('qty')}x "
        f"(Rp {format_rupiah_id(item.get('omzet', 0))})"
        for item in top[:3]
    )
    pertama = top[0]
    return (
        f"Produk terlaris 7 hari: {daftar}. Saran: dorong {pertama.get('nama')} "
        "— tampilkan paling depan di etalase atau jadikan paket bundling "
        "bareng item yang sepi."
    )


def _jawab_stok(context: dict[str, Any]) -> str:
    kritis = context.get("stok_kritis") or []
    if not kritis:
        return (
            "Tidak ada produk aktif di bawah stok minimum — persediaan sehat. "
            "Saran: cek halaman Stok untuk rotasi barang yang penjualannya "
            "lambat 30 hari terakhir."
        )
    daftar = ", ".join(
        f"{item.get('nama')} sisa {item.get('stok')} (minimum {item.get('min_stok')})"
        for item in kritis[:3]
    )
    restok = ", ".join(
        f"{item.get('nama')} +{item.get('saran_restok')}"
        for item in kritis[:3]
    )
    return (
        f"Stok menipis: {daftar}. Saran restok hari ini: {restok}. Belanja "
        "bisa menyusul besok pagi, tapi jangan sampai kehabisan saat jam ramai."
    )


def _jawab_prediksi(context: dict[str, Any], period: str) -> str:
    outlet = context.get("outlet", "-")
    prediksi = context.get("prediksi") or {}
    if prediksi.get("tersedia"):
        mape = prediksi.get("mape")
        mape_txt = (
            f", MAPE {mape:.1f}%".replace(".", ",")
            if isinstance(mape, (int, float)) and not isinstance(mape, bool)
            else ""
        )
        jangka = {"minggu": "7 hari", "bulan": "30 hari"}.get(period, "7 hari")
        return (
            f"Ramalan {jangka} ke depan untuk {outlet} sudah memakai model "
            f"terlatih (engine {prediksi.get('engine')}{mape_txt}); angka per "
            "hari ada di halaman Ramalan di dashboard. Model ini dilatih "
            "ulang otomatis di latar belakang setiap ada data baru. Saran: "
            "pakai angka ramalan untuk menyiapkan stok besok pagi."
        )
    progres = context.get("ml_progress") or {}
    if progres:
        return (
            f"Model ramalan {outlet} belum terlatih: butuh minimal "
            f"{progres.get('gerbang_pendapatan', 0)} hari ber-pendapatan, baru "
            f"terkumpul {progres.get('hari_pendapatan', 0)} hari. Tenang — "
            "model kini dilatih OTOMATIS di latar belakang begitu gerbang "
            "terpenuhi, tanpa perintah apa pun; sementara itu ramalan tetap "
            "jalan lewat jalur statistik. Saran: terus catat penjualan tiap "
            "hari supaya model makin cepat terlatih."
        )
    return (
        f"Model ramalan {outlet} belum terlatih; ramalan 7 hari tetap "
        "tersedia lewat jalur statistik (lihat halaman Ramalan di dashboard). "
        "Model dilatih otomatis setelah data cukup. Saran: catat penjualan "
        "harian supaya model segera terlatih."
    )


def _jawab_saran(context: dict[str, Any], period: str) -> str:
    outlet = context.get("outlet", "-")
    bagian: list[str] = []
    p = context.get("perubahan_mingguan_pct")
    if isinstance(p, (int, float)) and not isinstance(p, bool):
        if p >= 0:
            bagian.append(
                f"Momentum minggu ini bagus: omzet naik {_pct_id(p)}% "
                "dibanding minggu lalu."
            )
        else:
            bagian.append(
                f"Omzet minggu ini turun {_pct_id(p)}% dibanding minggu lalu "
                "— jangan panik, kita cari polanya."
            )
    else:
        bagian.append("Minggu lalu belum ada data pembanding, tren belum bisa dihitung.")
    top = _top_pertama(context)
    if top:
        bagian.append(
            f"{top.get('nama')} jadi andalan 7 hari ({top.get('qty')}x) — jaga "
            "stoknya tetap tersedia."
        )
    kritis = _stok_pertama(context)
    if kritis:
        bagian.append(
            f"Prioritas belanja: restok {kritis.get('nama')} "
            f"+{kritis.get('saran_restok')}."
        )
    prediksi = context.get("prediksi") or {}
    progres = context.get("ml_progress") or {}
    if not prediksi.get("tersedia") and progres:
        bagian.append(
            f"Model ramalan mulai terlatih otomatis setelah "
            f"{progres.get('gerbang_pendapatan', 0)} hari ber-pendapatan "
            f"(sudah {progres.get('hari_pendapatan', 0)} hari)."
        )
    if period == "minggu":
        if top:
            bagian.append(
                f"Saran minggu depan: stok {top.get('nama')} digenapi hari ini "
                "supaya tidak kehabisan saat akhir pekan."
            )
        else:
            bagian.append(
                "Saran minggu depan: catat penjualan konsisten dulu — "
                "saran saya makin tajam setiap ada data baru."
            )
    else:
        if top:
            bagian.append(
                f"Saran: kerjakan restok dulu, lalu dorong {top.get('nama')} "
                "sepanjang hari."
            )
        else:
            bagian.append(
                "Saran: mulai catat penjualan lewat kasir — data segar membuat "
                f"asisten {outlet} makin paham warungmu."
            )
    return " ".join(bagian)


def _jawab_ringkasan(context: dict[str, Any]) -> str:
    """Template ringkasan lama (v3.1.0) — dipakai bila maksud tak dikenal
    secara eksplisit oleh pemanggil lama (tanpa argumen intent)."""
    p = context.get("penjualan", {})

    def _omzet(kunci: str) -> str:
        blok = p.get(kunci) or {}
        return f"Rp {format_rupiah_id(blok.get('omzet', 0))}"

    bagian: list[str] = [
        f"Ringkasan {context.get('outlet', '-')}:",
        f"Penjualan hari ini {_omzet('hari_ini')}, kemarin {_omzet('kemarin')}, "
        f"7 hari {_omzet('tujuh_hari')}, 30 hari {_omzet('tiga_puluh_hari')}.",
    ]

    top = context.get("produk_top") or []
    if top:
        daftar = ", ".join(
            f"{item.get('nama')} ({item.get('qty')}x)" for item in top[:3]
        )
        bagian.append(f"Terlaris 7 hari: {daftar}.")

    kritis = context.get("stok_kritis") or []
    if kritis:
        daftar = ", ".join(
            f"{item.get('nama')} sisa {item.get('stok')}" for item in kritis[:3]
        )
        bagian.append(f"Stok menipis: {daftar}.")
        pertama = kritis[0]
        bagian.append(
            "Saran: restok "
            f"{pertama.get('nama')} +{pertama.get('saran_restok')} hari ini."
        )
    else:
        bagian.append("Saran: cek halaman Stok untuk rotasi barang lambat.")

    return " ".join(bagian)


def build_offline_answer(
    context: dict[str, Any],
    intent: str | None = None,
    period: str | None = None,
) -> str:
    """Jawaban Mode Data per-maksud + per-periode (v3.2.0).

    Dipakai saat LLM belum dikonfigurasi — asisten tetap berguna dan
    jujur (badge "Mode Data" di frontend memberi tahu penggunanya).
    Tanpa argumen maksud, jawab ringkasan umum (perilaku v3.1.x) supaya
    pemanggil lama tidak patah.
    """
    maksud = intent or "ringkasan"
    periode = period or "hari"
    if maksud == "identitas":
        return _jawab_identitas(context)
    if maksud == "kemampuan":
        return _jawab_kemampuan(context)
    if maksud == "sapaan":
        return _jawab_sapaan(context)
    if maksud == "terima_kasih":
        return _jawab_terima_kasih(context)
    if maksud == "penjualan":
        return _jawab_penjualan(context, periode)
    if maksud == "produk":
        return _jawab_produk(context)
    if maksud == "stok":
        return _jawab_stok(context)
    if maksud == "prediksi":
        return _jawab_prediksi(context, periode)
    if maksud == "saran_tindakan":
        return _jawab_saran(context, periode)
    return _jawab_ringkasan(context)


# ----------------------------------------------------------------------
# 6) Orkestrator generasi (LLM di-inject; None = offline)
# ----------------------------------------------------------------------
class LlmClient(Protocol):
    """Kontrak klien LLM — httpx asli (services/llm.py) atau stub test."""

    async def complete(
        self,
        messages: list[dict[str, str]],
        temperature: float = TEMPERATURE,
        max_tokens: int = MAX_TOKENS,
    ) -> str: ...


async def generate_answer(
    question: str,
    context: dict[str, Any],
    history: list[dict[str, str]],
    llm: LlmClient | None,
) -> dict[str, Any]:
    """Alur generasi blueprint: LLM -> validasi angka -> retry 1x -> flag.

    Hasil selalu memuat: answer, mode ("ai"|"data"), intent, period,
    numbers_validated, retried. Angka halusinasi yang bertahan setelah
    retry TIDAK dibuang — ditandai (frontend menampilkan peringatan).
    Mode Data (llm None) kini memakai jawaban per-maksud v3.2.0.
    """
    intent = classify_intent(question)
    period = extract_period(question)

    if llm is None:
        return {
            "answer": build_offline_answer(context, intent, period),
            "mode": "data",
            "intent": intent,
            "period": period,
            "numbers_validated": True,
            "retried": False,
        }

    allowed = collect_allowed_numbers(context)
    messages = build_messages(context, history, question)
    answer = await llm.complete(messages, TEMPERATURE, MAX_TOKENS)
    sah, pelanggar = validate_numbers(answer, allowed)

    retried = False
    if not sah:
        retried = True
        koreksi = messages + [
            {"role": "assistant", "content": answer},
            {"role": "user", "content": build_retry_instruction(pelanggar)},
        ]
        answer = await llm.complete(koreksi, TEMPERATURE, MAX_TOKENS)
        sah, _ = validate_numbers(answer, allowed)

    return {
        "answer": answer,
        "mode": "ai",
        "intent": intent,
        "period": period,
        "numbers_validated": sah,
        "retried": retried,
    }
