"""Regresi persistensi chat_history (v3.1.1).

Bug asli (smoke test pengguna, 2026-10-27): POST /assistant/chat
mengembalikan 500 — NotNullViolation kolom created_at saat INSERT
chat_history. Akarnya BUKAN DDL (migrasi Go #12 sudah membawa DEFAULT
NOW()): ORM SQLAlchemy 2.1 merender kolom yang tidak diisi sebagai NULL
EKSLISIT di daftar VALUES INSERT, sehingga default di sisi database
tidak pernah sempat bekerja. Perbaikan v3.1.1: _simpan_riwayat mengisi
created_at eksplisit + default Python di model ChatHistory.

Test menjalankan FUNGSI ASLI _simpan_riwayat lewat shim sesi sinkron
di atas SQLite in-memory yang DDL-nya ditulis TANPA default — lebih
ketat daripada Postgres produksi: bila ORM kembali mengirim NULL, test
ini gagal lebih dulu. Tanpa PostgreSQL/aiosqlite: tidak ada dependensi
baru yang perlu masuk ke image container.
"""

from __future__ import annotations

import asyncio
import datetime as dt

from sqlalchemy import create_engine, select, text
from sqlalchemy.orm import Session

from app.api.routes.assistant import _simpan_riwayat
from app.models import ChatHistory


class ShimSesiSinkron:
    """AsyncSession palsu: add_all/commit diteruskan ke Session ORM asli.

    _simpan_riwayat hanya memakai dua operasi itu; shim membuat fungsi
    async asli bisa diuji tanpa aiosqlite/psycopg jalan-nyata.
    """

    def __init__(self, nyata: Session) -> None:
        self._nyata = nyata
        self.add_all_dipanggil = 0
        self.commit_dipanggil = 0

    def add_all(self, objs) -> None:
        self.add_all_dipanggil += 1
        self._nyata.add_all(objs)

    async def commit(self) -> None:
        self.commit_dipanggil += 1
        self._nyata.commit()


def _engine_baru():
    """SQLite in-memory ber-DDL tangan: id INTEGER PRIMARY KEY (padanan
    BIGSERIAL Postgres di sqlite) dan created_at NOT NULL TANPA DEFAULT
    — stricter daripada produksi supaya regresi tertangkap di sini."""
    engine = create_engine("sqlite://")
    with engine.connect() as conn:
        conn.execute(text("DROP TABLE IF EXISTS chat_history"))
        conn.execute(
            text(
                """
                CREATE TABLE chat_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id BIGINT NOT NULL,
                    outlet_id BIGINT,
                    role TEXT NOT NULL CHECK (role IN ('USER','ASSISTANT')),
                    content TEXT NOT NULL,
                    created_at DATETIME NOT NULL
                )
                """
            )
        )
        conn.commit()
    return engine


def test_simpan_riwayat_mengisi_created_at_dua_baris() -> None:
    engine = _engine_baru()
    with Session(engine) as sesi:
        shim = ShimSesiSinkron(sesi)
        asyncio.run(
            _simpan_riwayat(
                shim, 4, "2", "berapa omzet hari ini?", "Rp 45.000."
            )
        )
        baris = list(
            sesi.execute(select(ChatHistory).order_by(ChatHistory.id)).scalars()
        )

    assert len(baris) == 2
    assert [b.role for b in baris] == ["USER", "ASSISTANT"]
    assert baris[0].content == "berapa omzet hari ini?"
    assert baris[1].content == "Rp 45.000."
    for b in baris:
        # Kolom yang dulu NULL (akar NotNullViolation) kini selalu terisi.
        assert isinstance(b.created_at, dt.datetime)
        assert b.created_at.year >= 2026


def test_pasangan_satu_add_all_satu_commit_waktu_sama() -> None:
    engine = _engine_baru()
    with Session(engine) as sesi:
        shim = ShimSesiSinkron(sesi)
        asyncio.run(_simpan_riwayat(shim, 9, None, "hai", "halo"))

        # Kontrak pasangan: satu add_all berisi dua baris, satu commit.
        assert shim.add_all_dipanggil == 1
        assert shim.commit_dipanggil == 1

        baris = list(
            sesi.execute(select(ChatHistory).order_by(ChatHistory.id)).scalars()
        )

    assert len(baris) == 2
    assert all(b.outlet_id is None for b in baris)
    # Satu cap waktu untuk kedua baris: urutan USER/ASSISTAN tidak
    # pernah terbalik karena selisih mikrodetik antar-baris.
    assert baris[0].created_at == baris[1].created_at


def test_default_model_menyelamatkan_penulis_lain() -> None:
    # Penulis lain (bukan _simpan_riwayat) yang lupa mengisi created_at
    # tetap selamat: default Python di model mengisi saat flush —
    # pertahanan kedua di bawah pengisian eksplisit.
    engine = _engine_baru()
    with Session(engine) as sesi:
        sesi.add(ChatHistory(user_id=1, outlet_id=None, role="USER", content="x"))
        sesi.commit()
        b = sesi.execute(select(ChatHistory)).scalars().one()
    assert isinstance(b.created_at, dt.datetime)
