"""Otak murni Asisten AI UMKM (ml-service v3.1.0) — blueprint BAB 6.5.

Modul ini 100% murni (tanpa DB, tanpa FastAPI, tanpa jaringan) supaya
bisa diuji penuh dengan stub ber-oracle. Ia menjalankan pseudocode 5
blueprint:

  1. classify_intent   — penjualan | stok | produk | saran_tindakan
  2. extract_period    — hari | minggu | bulan
  3. build_messages    — system prompt tegas + RIWAYAT maks 5 pesan
  4. validate_numbers  — angka jawaban harus bisa dijelaskan DATA
                         (eksak | toleransi 2% | pembulatan GRID 2,5%);
                         gagal -> 1 kali retry koreksi
  5. build_offline_answer — mode Data: jawaban template tanpa LLM

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
  }

Semua fungsi angka memakai format Indonesia: titik = ribuan, koma =
desimal ("Rp 1.250.000", "1,5 juta", "250rb").
"""

from __future__ import annotations

import re
from typing import Any, Iterable, Protocol

# Batas blueprint: jawaban ringkas, murah, dan jelas untuk pemilik warung.
MAX_ANSWER_WORDS = 120
# Riwayat yang dikirim ke LLM: cukup untuk konteks, hemat token.
HISTORY_TURNS = 5
# Parameter generasi blueprint BAB 6.5 (deterministik, bukan kreatif).
TEMPERATURE = 0.2
MAX_TOKENS = 400

INTENTS = ("penjualan", "stok", "produk", "saran_tindakan")
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

# Kata kunci klasifikasi (urutan penting: saran_diperiksa pertama supaya
# "berapa omzet dan sarannya" tidak salah masuk penjualan).
_KW_SARAN = (
    "saran", "sarankan", "rekomendasi", "rekomendasikan", "tips", "nasihat",
    "strategi", "harus apa", " harus ", "apa yang harus", "apa yang bisa",
    "gimana cara", "bagaimana cara", "apa selanjutnya", "maka apa",
)
_KW_PENJUALAN = (
    "omzet", "omset", "pendapatan", "penjualan", "terjual", "jual",
    "uang masuk", "penghasilan", "revenue", "transaksi", "laba", "untung",
    "rugi", "hasil",
)
_KW_STOK = (
    "stok", "stock", "sisa", "habis", "menipis", "kosong", "restok",
    "restock", "persediaan", "gudang", "inventaris", "beli lagi",
    "tambah barang",
)
_KW_PRODUK = (
    "produk", "barang", "item", "terlaris", "paling laku", "paling banyak",
    "populer", "best seller", "favorit", "kategori", "mana yang laku",
    "daftar menu", "menu apa",
)

_KW_HARI = (
    "hari ini", "kemarin", " tadi ", "harian", "per hari", "sehari",
    "hari kemarin",
)
_KW_MINGGU = (
    "minggu", "pekan", "7 hari", "tujuh hari", "seminggu", "sepekan",
)
_KW_BULAN = (
    "bulan", "30 hari", "tiga puluh hari", "sebulan", "bulanan",
    "bulan ini", "bulan lalu",
)

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
# 1) Klasifikasi maksud & ekstraksi waktu
# ----------------------------------------------------------------------
def _hit(text: str, keywords: Iterable[str]) -> bool:
    t = f" {text.lower()} "
    return any(k in t for k in keywords)


def classify_intent(question: str) -> str:
    """Maksud pertanyaan: penjualan | stok | produk | saran_tindakan.

    Default = saran_tindakan: pertanyaan bebas ("gimana ya?") paling
    dijawab dengan ringkasan + saran, bukan ditolak.
    """
    if _hit(question, _KW_SARAN):
        return "saran_tindakan"
    if _hit(question, _KW_STOK):
        return "stok"
    if _hit(question, _KW_PRODUK):
        return "produk"
    if _hit(question, _KW_PENJUALAN):
        return "penjualan"
    return "saran_tindakan"


def extract_period(question: str) -> str:
    """Periode yang DIMAKSUD penanya: hari | minggu | bulan (default hari)."""
    if _hit(question, _KW_BULAN):
        return "bulan"
    if _hit(question, _KW_MINGGU):
        return "minggu"
    return "hari"


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


# ----------------------------------------------------------------------
# 3) Kumpulan angka sah dari context
# ----------------------------------------------------------------------
def collect_allowed_numbers(context: dict[str, Any]) -> list[float]:
    """Semua angka DATA yang boleh muncul di jawaban (+ jendela waktu).

    Jendela 7/30 hari ikut diizinkan supaya frasa template ("7 hari
    terakhir") tidak salah bunyi. Boolean DIBUANG (bukan angka data).
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
    """System prompt tegas blueprint BAB 6.5 + blok DATA terformat."""
    p = context.get("perubahan_mingguan_pct")
    tren = "tidak tersedia"
    if isinstance(p, (int, float)) and not isinstance(p, bool):
        tren = f"{'naik' if p >= 0 else 'turun'} {abs(p):.1f}%".replace(".", ",")

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

    return (
        "Kamu adalah asisten bisnis warung UMKM Indonesia. Jawab pemilik "
        f"warung {context.get('outlet', '-')} dengan bahasa Indonesia "
        "sehari-hari yang hangat tapi ringkas.\n"
        "ATURAN WAJIB:\n"
        "1. Jawab HANYA dari DATA di bawah — DILARANG mengarang atau "
        "menebak angka.\n"
        f"2. Maksimal {MAX_ANSWER_WORDS} kata.\n"
        "3. Akhiri jawaban dengan TEPAT 1 saran tindakan konkret.\n"
        "4. Bila DATA tidak memuat jawabannya, katakan bagian mana yang "
        "tidak tersedia.\n"
        "5. Format uang gaya Indonesia: Rp 1.250.000 (titik ribuan).\n"
        "DATA:\n"
        + "\n".join(_baris_penjualan(context))
        + f"\n- Perubahan omzet minggu ini vs minggu lalu: {tren}"
        + f"\n- Produk terlaris 7 hari: {baris_top}"
        + f"\n- Stok menipis: {baris_stok}"
        + f"\n- Ramalan 7 hari: {baris_prediksi}"
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
# 5) Mode Data (offline) — jawaban template tanpa LLM
# ----------------------------------------------------------------------
def build_offline_answer(context: dict[str, Any]) -> str:
    """Jawaban Mode Data: semua angka dari template, tak ada LLM.

    Dipakai saat LLM belum dikonfigurasi — asisten tetap berguna dan
    jujur (badge "Mode Data" di frontend memberi tahu penggunanya).
    """
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
    """
    intent = classify_intent(question)
    period = extract_period(question)

    if llm is None:
        return {
            "answer": build_offline_answer(context),
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
