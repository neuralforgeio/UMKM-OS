"""OSCAR Developer AI (ml-service v3.4.0) — akses lintas toko ber-PIN.

Peran & batas (v2.7.0):
  - AI Developer = satu-satunya pihak yang berhak membaca data SEMUA
    toko sekaligus. Owner di panel chat tetap privat: seluruh retrieval
    routes/assistant.py terikat outlet pemilik, dan system prompt
    melarang OSCAR membahas data toko lain (aturan 10).
  - Pelaporan PROAKTIF: loop latar belakang (lifespan main.py) tiap
    interval memeriksa pemicu — stok kritis gabungan, omzet turun,
    toko diam — dan menyimpan laporan TANPA diminta ke dev_reports.json
    (volume mlmodels, tidak pernah masuk git).

Keamanan:
  - PIN di dev_config.json (volume mlmodels), dibandingkan konstan-waktu
    (secrets.compare_digest); pintu endpoint + chat sama-sama ber-PIN.
  - Laporan lintas toko tidak pernah dikirim ke LLM: jawaban Mode
    Developer disusun langsung dari mesin (routes memotong jalur LLM).
"""

from __future__ import annotations

import asyncio
import json
import os
import secrets
import threading
from datetime import datetime, timezone

_MAKS_LAPORAN = 50
_FRASA_DEV = (
    "mode developer",
    "developer mode",
    "laporan developer",
    "developer report",
    "laporan lintas toko",
    "lintas toko",
)
_kunci_tulis = threading.Lock()


# ------------------------------------------------------------------ berkas
def _dir_ml() -> str:
    """Direktori volume mlmodels (env ML_MODEL_DIR di compose = /app/mlmodels)."""
    return os.environ.get("ML_MODEL_DIR", "mlmodels")


def _config_path() -> str:
    return os.environ.get(
        "OSCAR_DEV_CONFIG", os.path.join(_dir_ml(), "dev_config.json")
    )


def _reports_path() -> str:
    return os.environ.get(
        "OSCAR_DEV_REPORTS", os.path.join(_dir_ml(), "dev_reports.json")
    )


# ------------------------------------------------------------------ config
def baca_config() -> dict:
    """Baca dev_config.json (nilai hilang memakai default di bawah)."""
    acuan = {
        "enabled": False,
        "pin": "",
        "interval_detik": 900,
        "stok_kritis_min": 5,
        "omzet_turun_persen": 20.0,
        "diam_jam": 48.0,
    }
    try:
        with open(_config_path(), "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict):
            for k in acuan:
                if k in data:
                    acuan[k] = data[k]
    except Exception:
        pass
    return acuan


def _pin_sama(a, b) -> bool:
    try:
        return secrets.compare_digest(str(a or "").strip(), str(b or "").strip())
    except Exception:
        return False


def pin_sah(pin: str) -> bool:
    """PIN developer sah & mode aktif (dipakai endpoint)."""
    cfg = baca_config()
    if not cfg.get("enabled") or not cfg.get("pin"):
        return False
    return _pin_sama(pin, cfg.get("pin"))


def pesan_dev_sah(pesan: str) -> bool:
    """True bila pesan memuat frasa developer + PIN yang sah (dipakai chat)."""
    cfg = baca_config()
    if not cfg.get("enabled") or not cfg.get("pin"):
        return False
    teks = str(pesan or "").lower()
    if not any(f in teks for f in _FRASA_DEV):
        return False
    return str(cfg["pin"]).strip().lower() in teks


# ------------------------------------------------------------------ laporan
def muat_laporan() -> list:
    try:
        with open(_reports_path(), "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, list) else []
    except Exception:
        return []


def simpan_laporan(entri: dict) -> None:
    with _kunci_tulis:
        daftar = muat_laporan()
        daftar.append(entri)
        daftar = daftar[-_MAKS_LAPORAN:]
        sementara = _reports_path() + ".tmp"
        with open(sementara, "w", encoding="utf-8") as f:
            json.dump(daftar, f, ensure_ascii=False, indent=1)
        os.replace(sementara, _reports_path())


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _umur_jam(iso: str) -> float:
    """Umur entri laporan dalam jam (invalid = sangat tua)."""
    try:
        t = datetime.fromisoformat(str(iso))
    except Exception:
        return 999.0
    if t.tzinfo is None:
        t = t.replace(tzinfo=timezone.utc)
    return max(0.0, (datetime.now(timezone.utc) - t).total_seconds() / 3600.0)


# ------------------------------------------------------------------ retrieval
async def ringkas_lintas_toko(session) -> dict:
    """Agregat SEMUA outlet 7 hari + pembanding + stok kritis gabungan.

    HANYA dipanggil jalur Mode Developer (ber-PIN) — satu-satunya
    tempat query tanpa filter outlet di layanan ML.
    """
    from datetime import date, timedelta

    from sqlalchemy import func, select

    from app.models import Outlet, Product, Transaction

    hari = date.today()
    mulai7 = hari - timedelta(days=6)
    mulai14 = hari - timedelta(days=13)
    akhir_lalu = hari - timedelta(days=7)

    async def _omzet(mulai, akhir) -> dict:
        baris = (
            await session.execute(
                select(
                    Transaction.outlet_id,
                    func.count(Transaction.id),
                    func.coalesce(func.sum(Transaction.total), 0),
                )
                .where(
                    Transaction.status == "COMPLETED",
                    func.date(Transaction.created_at) >= mulai,
                    func.date(Transaction.created_at) <= akhir,
                )
                .group_by(Transaction.outlet_id)
            )
        ).all()
        hasil = {}
        for r in baris:
            oid = int(r[0]) if r[0] is not None else 0
            hasil[oid] = {"transaksi": int(r[1] or 0), "omzet": int(r[2] or 0)}
        return hasil

    nama_outlet = {0: "(tanpa outlet)"}
    for o in (
        (
            await session.execute(
                select(Outlet).where(Outlet.is_active.is_(True))
            )
        )
        .scalars()
        .all()
    ):
        nama_outlet[int(o.id)] = o.name

    kini = await _omzet(mulai7, hari)
    lalu = await _omzet(mulai14, akhir_lalu)

    toko = []
    for oid, info in sorted(kini.items(), key=lambda kv: -kv[1]["omzet"]):
        toko.append(
            {
                "outlet_id": oid,
                "nama": nama_outlet.get(oid, f"outlet {oid}"),
                "transaksi": info["transaksi"],
                "omzet": info["omzet"],
                "omzet_lalu": (lalu.get(oid) or {}).get("omzet", 0),
            }
        )
    diam = [
        {"outlet_id": oid, "nama": nama_outlet.get(oid, f"outlet {oid}")}
        for oid in sorted(lalu)
        if oid not in kini
    ]

    baris_stok = (
        await session.execute(
            select(
                Product.outlet_id,
                Product.name,
                Product.stock,
                Product.min_stock,
            )
            .where(
                Product.is_active.is_(True),
                Product.stock <= Product.min_stock,
            )
            .order_by((Product.stock - Product.min_stock).asc())
            .limit(20)
        )
    ).all()
    stok_kritis = [
        {
            "nama": r[1],
            "stok": int(r[2] or 0),
            "min_stok": int(r[3] or 0),
            "toko": nama_outlet.get(
                int(r[0]) if r[0] is not None else 0, "?"
            ),
        }
        for r in baris_stok
    ]

    return {
        "dibuat": _now_iso(),
        "jumlah_outlet": len(nama_outlet) - 1,  # kurangi placeholder 0
        "toko": toko,
        "toko_diam": diam,
        "stok_kritis": stok_kritis,
    }


async def bangun_ringkasan() -> dict:
    """Buka sesi sendiri lalu agregat lintas toko (jalur Mode Developer)."""
    from app.core.database import session_factory

    async with session_factory() as session:
        return await ringkas_lintas_toko(session)


# ------------------------------------------------------------------ pemformatan
def teks_laporan(r: dict, pemicu: list) -> str:
    """Laporan lintas toko siap baca — Bahasa Indonesia, tanpa angka karangan."""
    baris = ["LAPORAN DEVELOPER - ringkasan lintas toko 7 hari terakhir"]
    toko = r.get("toko") or []
    if toko:
        for t in toko[:8]:
            lalu = int(t.get("omzet_lalu") or 0)
            pembanding = f" (minggu lalu Rp {lalu})" if lalu else ""
            baris.append(
                f"- {t.get('nama')}: {t.get('transaksi')} transaksi, "
                f"omzet Rp {t.get('omzet')}{pembanding}"
            )
    else:
        baris.append("- belum ada transaksi 7 hari terakhir")
    kritis = r.get("stok_kritis") or []
    if kritis:
        baris.append(f"Stok kritis gabungan ({len(kritis)} produk):")
        for s in kritis[:10]:
            baris.append(
                f"- {s.get('nama')} sisa {s.get('stok')} "
                f"(toko {s.get('toko')})"
            )
    diam = r.get("toko_diam") or []
    if diam:
        baris.append(
            "Toko tanpa transaksi minggu ini: "
            + ", ".join(str(d.get("nama", "?")) for d in diam[:10])
        )
    if pemicu:
        baris.append("PEMICU LAPORAN:")
        for p in pemicu:
            baris.append(f"- {p}")
    return "\n".join(baris)


def cek_pemicu(r: dict, cfg: dict) -> list:
    """Pemicu pelaporan proaktif — teks pendek, angka hanya dari ringkasan."""
    pemicu = []
    kritis = r.get("stok_kritis") or []
    if len(kritis) >= 3:
        pemicu.append(
            f"stok kritis gabungan: {len(kritis)} produk sisa <= "
            f"minimum (prioritas restok)"
        )
    daftar_toko = r.get("toko") or []
    total_ini = sum(int(t.get("omzet") or 0) for t in daftar_toko)
    total_lalu = sum(int(t.get("omzet_lalu") or 0) for t in daftar_toko)
    if total_lalu > 0:
        turun = (total_lalu - total_ini) / total_lalu * 100.0
        batas = float(cfg.get("omzet_turun_persen", 20.0) or 20.0)
        if turun > batas:
            pemicu.append(
                f"omzet turun {int(round(turun))}% dibanding minggu lalu"
            )
    diam = r.get("toko_diam") or []
    if diam:
        pemicu.append(f"{len(diam)} toko tanpa transaksi minggu ini")
    return pemicu


# ------------------------------------------------------------------ pelaporan proaktif
async def laporan_proaktif(paksa: bool = False) -> dict | None:
    """Satu siklus: cek pemicu, simpan laporan bila ada / digest jatuh tempo."""
    cfg = baca_config()
    if not cfg.get("enabled"):
        return None
    try:
        r = await bangun_ringkasan()
    except Exception as ex:
        r = {
            "dibuat": _now_iso(),
            "jumlah_outlet": 0,
            "toko": [],
            "toko_diam": [],
            "stok_kritis": [],
            "catatan": f"ringkasan gagal: {type(ex).__name__}",
        }
    pemicu = cek_pemicu(r, cfg)
    daftar = muat_laporan()
    terakhir = str((daftar[-1] or {}).get("waktu", "")) if daftar else ""
    butuh_digest = True
    if terakhir:
        butuh_digest = _umur_jam(terakhir) >= 20.0
    if not pemicu and not butuh_digest and not paksa:
        return None
    jenis = "peringatan" if pemicu else "digest-harian"
    entri = {
        "waktu": _now_iso(),
        "jenis": jenis,
        "pemicu": pemicu,
        "teks": teks_laporan(r, pemicu),
    }
    simpan_laporan(entri)
    return entri


async def proactive_loop() -> None:
    """Loop latar belakang — dinyalakan lifespan main.py (v2.7.0).

    Saklar darurat: env OSCAR_DEV_PROACTIVE=0 mematikan seluruhnya.
    """
    if os.environ.get("OSCAR_DEV_PROACTIVE", "") == "0":
        return
    await asyncio.sleep(120.0)
    while True:
        try:
            await laporan_proaktif()
        except Exception:
            pass
        try:
            jeda = float(baca_config().get("interval_detik", 900) or 900)
        except Exception:
            jeda = 900.0
        if jeda < 60.0:
            jeda = 60.0
        await asyncio.sleep(jeda)


# ------------------------------------------------------------------ pintu chat & endpoint
async def jawab_chat(pesan: str) -> str:
    """Jawaban chat Mode Developer — PIN diverifikasi PALING AWAL."""
    cfg = baca_config()
    if not cfg.get("enabled"):
        return (
            "Mode Developer belum diaktifkan di server ini. Data toko "
            "lain tetap privat dan tidak bisa dibuka dari obrolan."
        )
    if not pesan_dev_sah(pesan):
        return (
            "Mode Developer terkunci: sertakan PIN developer pada pesan "
            "(contoh: 'mode developer <PIN> laporan lintas toko'). PIN "
            "hanya dipegang pengembang dan tersimpan di server, bukan di "
            "repo. Jangan pernah bagikan PIN ke siapa pun."
        )
    try:
        r = await bangun_ringkasan()
        teks = teks_laporan(r, cek_pemicu(r, cfg))
    except Exception as ex:
        teks = (
            "Ringkasan lintas toko belum tersedia sekarang ("
            f"{type(ex).__name__}). Laporan proaktif terakhir tetap "
            "terbaca lewat endpoint /oscar-developer-report."
        )
    daftar = muat_laporan()
    tambahan = ""
    if daftar:
        terakhir = daftar[-1]
        cuplikan = str(terakhir.get("teks", ""))
        if len(cuplikan) > 500:
            cuplikan = cuplikan[:500] + " ..."
        tambahan = (
            "\n\nLaporan proaktif terakhir ("
            f"{terakhir.get('waktu', '?')} / {terakhir.get('jenis', '?')}):\n"
            f"{cuplikan}"
        )
    return (
        "MODE DEVELOPER AKTIF - akses lintas toko khusus pengembang.\n\n"
        + teks
        + tambahan
    )


async def api_report(pin: str):
    """Muatan endpoint laporan developer (PIN wajib)."""
    if not pin_sah(pin):
        return False, {
            "ok": False,
            "error": "PIN developer salah atau Mode Developer belum diaktifkan.",
        }
    try:
        r = await bangun_ringkasan()
        teks = teks_laporan(r, cek_pemicu(r, baca_config()))
    except Exception as ex:
        r = {
            "dibuat": _now_iso(),
            "jumlah_outlet": 0,
            "toko": [],
            "toko_diam": [],
            "stok_kritis": [],
            "catatan": f"ringkasan gagal: {type(ex).__name__}",
        }
        teks = (
            "Ringkasan lintas toko belum tersedia ("
            f"{type(ex).__name__}). Coba lagi beberapa saat lagi."
        )
    return True, {
        "ok": True,
        "laporan_terbaru": muat_laporan()[-10:],
        "ringkasan": r,
        "teks": teks,
    }
