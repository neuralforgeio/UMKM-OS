"""Endpoint Asisten AI RAG (ml-service v3.2.0) — blueprint BAB 6.5.

POST /api/v1/assistant/chat     — jawab pertanyaan pemilik dari DATA
GET  /api/v1/assistant/history  — riwayat percakapan (panel frontend)
GET  /api/v1/assistant/status   — status mode/model (PUBLIK, konsol dev)
GET  /api/v1/assistant/llm-config — pengaturan LLM efektif (kunci masker)
PUT  /api/v1/assistant/llm-config — simpan pengaturan LLM dari UI
                                     Pengaturan (tanpa restart container)

Alur chat (semua langkah ada alasan biaya/kejujuran di blueprint):
  1. Gerbang X-Internal-Key (INTERNAL_API_KEY; kosong = terbuka dev
     lokal). Identitas user_id DIPERCAYAI gateway frontend yang sudah
     memeriksa sesi NextAuth — pola sama seperti seluruh layanan ini
     yang berada di jaringan internal docker.
  2. Batas laju sliding-window per user (default 12/jam, BAB 9.3).
  3. Cache jawaban per user+outlet+pertanyaan ternormalisasi (TTL 600s)
     — pertanyaan pagian yang sama tidak membakar token dua kali.
  4. Retrieval SQL BACA-SAJA: ringkasan penjualan (hari/kemarin/7d/30d),
     tren mingguan, produk terlaris 7 hari, stok kritis + saran restok,
     status model ramalan outlet (tanpa memicu training), plus
     KEMAJUAN GERBANG ML (hari ber-pendapatan terkumpul vs syarat) —
     supaya jawaban prediksi/saran bisa menjelaskan "kapan model mulai
     terlatih otomatis" secara jujur (v3.2.0).
  5. Generasi: LLM bila terkonfigurasi (temperatur 0,2, 400 token,
     validasi angka + 1 retry koreksi), atau Mode Data per-maksud
     v3.2.0 (identitas/sapaan/penjualan/stok/produk/prediksi/saran
     masing-masing dijawab spesifik — bukan satu template kembar).
     Kegagalan LLM (jaringan/penyedia) JATUH ke Mode Data — asisten
     tidak pernah tumbang.
  6. Persist chat_history (USER lalu ASSISTANT) — tabel ini satu-
     satunya pengecualian tulis layanan ML; DDL tetap milik migrasi
     backend-go #12.

Data tetap MILIK Go (transactions.outlet_id dsb.) — pembacaan di sini
memakai kolom yang sama dengan laporan Go: satu sumber kebenaran.
"""

from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_session
from app.models import ChatHistory, Outlet, Product, Transaction, TransactionItem
from app.api.routes.forecast import resolve_outlet
from app.ml import trainer as ml_trainer
from app.schemas.assistant import (
    AssistantStatus,
    ChatHistoryMessage,
    ChatRequest,
    ChatResponse,
    HistoryResponse,
    LlmConfigIn,
    LlmConfigOut,
)
from app.services import assistant as otak
from app.services.answer_cache import AnswerCache
from app.services.llm import get_llm_client, llm_configured
from app.services.llm_config_store import (
    effective_llm_config,
    mask_key,
    save_file_config,
)
from app.services.rate_limit import SlidingWindowLimiter

router = APIRouter(prefix="/assistant", tags=["Asisten AI"])

# Singletons proses (settings tidak berubah saat runtime).
_limiter = SlidingWindowLimiter(settings.ASSISTANT_RATE_LIMIT_PER_HOUR)
_cache = AnswerCache(settings.ASSISTANT_CACHE_SECONDS)


# ----------------------------------------------------------------------
# Gerbang antar-layanan (blueprint BAB 5.4)
# ----------------------------------------------------------------------
async def require_internal_key(request: Request) -> None:
    """401 bila INTERNAL_API_KEY diset tapi header tidak cocok.

    Kosong (default dev lokal tanpa docker) = pintu terbuka; di dalam
    compose nilainya diambil dari AUTH_SECRET root sehingga frontend
    dan layanan ML berbagi kunci yang sama tanpa env tambahan.
    """
    kunci = settings.INTERNAL_API_KEY
    if not kunci:
        return
    if request.headers.get("X-Internal-Key", "") != kunci:
        raise HTTPException(status_code=401, detail="X-Internal-Key tidak sah")


# ----------------------------------------------------------------------
# Retrieval SQL baca-saja
# ----------------------------------------------------------------------
async def _ringkas_penjualan(
    session: AsyncSession, outlet_id: str | None
) -> dict:
    """Omzet + jumlah transaksi untuk 4 jendela waktu (termasuk hari
    berjalan sebagai potongan hidup — pemilik bertanya sepanjang hari,
    menunggu tutup buku justru membohongkan 'hari ini')."""
    hari = date.today()
    jendela = {
        "hari_ini": (hari, hari),
        "kemarin": (hari - timedelta(days=1), hari - timedelta(days=1)),
        "tujuh_hari": (hari - timedelta(days=6), hari),
        "tiga_puluh_hari": (hari - timedelta(days=29), hari),
    }
    hasil: dict[str, dict[str, int]] = {}
    for nama, (mulai, akhir) in jendela.items():
        syarat = [
            Transaction.status == "COMPLETED",
            func.date(Transaction.created_at) >= mulai,
            func.date(Transaction.created_at) <= akhir,
        ]
        if outlet_id:
            syarat.append(Transaction.outlet_id == int(outlet_id))
        baris = (
            await session.execute(
                select(
                    func.coalesce(func.sum(Transaction.total), 0),
                    func.count(Transaction.id),
                ).where(*syarat)
            )
        ).one()
        hasil[nama] = {"omzet": int(baris[0] or 0), "transaksi": int(baris[1] or 0)}
    return hasil


async def _perubahan_mingguan(
    session: AsyncSession, outlet_id: str | None
) -> float | None:
    """WoW: 7 hari terakhir vs 7 hari sebelumnya (None bila minggu lalu 0)."""
    hari = date.today()
    minggu_ini = (hari - timedelta(days=6), hari)
    minggu_lalu = (hari - timedelta(days=13), hari - timedelta(days=7))

    async def _omzet(jangkauan: tuple[date, date]) -> int:
        mulai, akhir = jangkauan
        syarat = [
            Transaction.status == "COMPLETED",
            func.date(Transaction.created_at) >= mulai,
            func.date(Transaction.created_at) <= akhir,
        ]
        if outlet_id:
            syarat.append(Transaction.outlet_id == int(outlet_id))
        baris = (
            await session.execute(
                select(func.coalesce(func.sum(Transaction.total), 0)).where(*syarat)
            )
        ).one()
        return int(baris[0] or 0)

    kini = await _omzet(minggu_ini)
    dulu = await _omzet(minggu_lalu)
    if dulu == 0:
        return None
    return round((kini - dulu) / dulu * 100.0, 1)


async def _produk_top(session: AsyncSession, outlet_id: str | None,
                      limit: int = 5) -> list[dict]:
    """Produk terlaris 7 hari (qty + omzet) — trenProduk blueprint."""
    hari = date.today()
    mulai = hari - timedelta(days=6)
    syarat = [
        Transaction.status == "COMPLETED",
        func.date(Transaction.created_at) >= mulai,
    ]
    if outlet_id:
        syarat.append(Transaction.outlet_id == int(outlet_id))
    baris = (
        await session.execute(
            select(
                TransactionItem.product_name,
                func.sum(TransactionItem.qty),
                func.sum(TransactionItem.subtotal),
            )
            .join(Transaction, TransactionItem.transaction_id == Transaction.id)
            .where(*syarat)
            .group_by(TransactionItem.product_name)
            .order_by(func.sum(TransactionItem.qty).desc())
            .limit(limit)
        )
    ).all()
    return [
        {"nama": r[0], "qty": int(r[1] or 0), "omzet": int(r[2] or 0)}
        for r in baris
    ]


async def _stok_kritis(session: AsyncSession, outlet_id: str | None,
                       limit: int = 6) -> list[dict]:
    """Produk aktif dengan stok <= min_stok + saran restok ringan.

    Saran restok = cukup ke 2x min_stok (pembelian hati-hati UMKM,
    bukan EOQ penuh — blueprint menamai ini 'saran restok ringan').
    """
    syarat = [
        Product.is_active.is_(True),
        Product.stock <= Product.min_stock,
    ]
    if outlet_id:
        syarat.append(Product.outlet_id == int(outlet_id))
    baris = (
        await session.execute(
            select(Product)
            .where(*syarat)
            .order_by((Product.stock - Product.min_stock).asc())
            .limit(limit)
        )
    ).scalars().all()

    # v2.6.0: kecepatan laku 7 hari per produk -> estimasi hari habis.
    hari = date.today()
    mulai7 = hari - timedelta(days=6)
    syarat7 = [
        Transaction.status == "COMPLETED",
        func.date(Transaction.created_at) >= mulai7,
    ]
    if outlet_id:
        syarat7.append(Transaction.outlet_id == int(outlet_id))
    baris7 = (
        await session.execute(
            select(
                TransactionItem.product_name,
                func.sum(TransactionItem.qty),
            )
            .join(Transaction, TransactionItem.transaction_id == Transaction.id)
            .where(*syarat7)
            .group_by(TransactionItem.product_name)
        )
    ).all()
    laku7 = {nama: int(qty or 0) for nama, qty in baris7}

    hasil = []
    for p in baris:
        kecepatan = round(laku7.get(p.name, 0) / 7.0, 2)
        hari_habis = None
        if kecepatan > 0:
            hari_habis = round(int(p.stock) / kecepatan, 1)
        elif int(p.stock) <= 0:
            hari_habis = 0.0
        hasil.append(
            {
                "nama": p.name,
                "stok": int(p.stock),
                "min_stok": int(p.min_stock),
                "saran_restok": max(0, int(p.min_stock * 2 - p.stock)),
                "kecepatan_hari": kecepatan,
                "hari_habis": hari_habis,
            }
        )
    return hasil


async def _jam_ramai(
    session: AsyncSession, outlet_id: str | None, limit: int = 3
) -> list[dict]:
    """v2.6.0: jam belanja paling ramai 7 hari (jumlah transaksi/jam)."""
    hari = date.today()
    mulai = hari - timedelta(days=6)
    syarat = [
        Transaction.status == "COMPLETED",
        func.date(Transaction.created_at) >= mulai,
    ]
    if outlet_id:
        syarat.append(Transaction.outlet_id == int(outlet_id))
    baris = (
        await session.execute(
            select(
                func.extract("hour", Transaction.created_at),
                func.count(Transaction.id),
            )
            .where(*syarat)
            .group_by(func.extract("hour", Transaction.created_at))
            .order_by(func.count(Transaction.id).desc())
            .limit(limit)
        )
    ).all()
    return [{"jam": int(r[0]), "transaksi": int(r[1])} for r in baris]


async def _status_prediksi(outlet_id: str | None) -> dict:
    """Status model ramalan outlet TANPA memicu training (baca store).

    Lazy training v3.0.0 sengaja tidak dipanggil dari asisten: chat
    harus cepat, dan pemilik sudah membuka dashboard yang memicunya.
    """
    if not outlet_id:
        return {"tersedia": False, "engine": None, "mape": None}
    try:
        from app.api.routes.forecast import get_store

        artefak = get_store().load(outlet_id)
    except Exception:  # store/import gagal => status jujur "tidak ada"
        artefak = None
    if artefak is None:
        return {"tersedia": False, "engine": None, "mape": None}
    return {
        "tersedia": True,
        "engine": artefak.get("winner"),
        "mape": artefak.get("mape_prophet")
        if artefak.get("winner") == "prophet"
        else artefak.get("mape_statistical"),
    }


async def _progress_ml(
    session: AsyncSession, outlet_id: str | None
) -> dict:
    """Kemajuan gerbang data model ramalan outlet (v3.2.0).

    Hari ber-pendapatan terkumpul vs syarat gerbang — dipakai jawaban
    prediksi/saran Mode Data supaya pemilik tahu model dilatih OTOMATIS
    begitu angka ini terpenuhi (auto-train latar belakang), bukan
    menunggu siapa pun menjalankan perintah.
    """
    mulai = date.today() - timedelta(days=ml_trainer.MODEL_WINDOW_DAYS - 1)
    syarat = [
        Transaction.status == "COMPLETED",
        func.date(Transaction.created_at) >= mulai,
    ]
    if outlet_id:
        syarat.append(Transaction.outlet_id == int(outlet_id))
    harian = (
        select(
            func.date(Transaction.created_at).label("d"),
            func.sum(Transaction.total).label("omzet"),
        )
        .where(*syarat)
        .group_by(func.date(Transaction.created_at))
        .subquery()
    )
    baris = (
        await session.execute(
            select(
                func.count(),
                func.coalesce(
                    func.sum(case((harian.c.omzet > 0, 1), else_=0)), 0
                ),
            )
        )
    ).one()
    hari_data = int(baris[0] or 0)
    hari_pendapatan = int(baris[1] or 0)
    return {
        "hari_data": hari_data,
        "hari_pendapatan": hari_pendapatan,
        "gerbang_hari": ml_trainer.MIN_DAYS,
        "gerbang_pendapatan": ml_trainer.MIN_NONZERO,
        "gerbang_terpenuhi": (
            hari_data >= ml_trainer.MIN_DAYS
            and hari_pendapatan >= ml_trainer.MIN_NONZERO
        ),
    }


async def build_data_context(
    session: AsyncSession, outlet_id: str | None, outlet_name: str
) -> dict:
    """Konteks DATA lengkap untuk prompt/validasi (BAB 6.5)."""
    return {
        "outlet": outlet_name,
        "penjualan": await _ringkas_penjualan(session, outlet_id),
        "perubahan_mingguan_pct": await _perubahan_mingguan(session, outlet_id),
        "produk_top": await _produk_top(session, outlet_id),
        "stok_kritis": await _stok_kritis(session, outlet_id),
        "jam_ramai": await _jam_ramai(session, outlet_id),
        "prediksi": await _status_prediksi(outlet_id),
        "ml_progress": await _progress_ml(session, outlet_id),
    }


# ----------------------------------------------------------------------
# Riwayat & persistensi
# ----------------------------------------------------------------------
async def _muat_riwayat(
    session: AsyncSession, user_id: int, limit: int
) -> list[dict[str, str]]:
    """Pesan terakhir (kronologis naik) untuk konteks LLM & panel."""
    baris = (
        await session.execute(
            select(ChatHistory)
            .where(ChatHistory.user_id == user_id)
            .order_by(ChatHistory.created_at.desc(), ChatHistory.id.desc())
            .limit(limit)
        )
    ).scalars().all()
    return [
        {"role": b.role, "content": b.content} for b in reversed(baris)
    ]


async def _simpan_riwayat(
    session: AsyncSession, user_id: int, outlet_id: str | None,
    pertanyaan: str, jawaban: str,
) -> None:
    """Dua baris (USER lalu ASSISTAN) — tabel tulis-satu-satunya.

    v3.1.1: created_at diisi EKSPLISIT. ORM SQLAlchemy 2.1 merender
    kolom yang tidak diisi sebagai NULL eksplisit di daftar VALUES
    INSERT, sehingga DEFAULT NOW() milik database (migrasi Go #12)
    tidak pernah sempat bekerja -> NotNullViolation -> 500 pada
    /assistant/chat. Satu cap waktu untuk kedua baris: urutan
    USER/ASSISTAN tidak pernah terbalik karena selisih mikrodetik.
    """
    oid = int(outlet_id) if outlet_id else None
    now = datetime.now(timezone.utc)
    session.add_all(
        [
            ChatHistory(
                user_id=user_id, outlet_id=oid, role="USER",
                content=pertanyaan, created_at=now,
            ),
            ChatHistory(
                user_id=user_id, outlet_id=oid, role="ASSISTANT",
                content=jawaban, created_at=now,
            ),
        ]
    )
    await session.commit()


# ----------------------------------------------------------------------
# Endpoint
# ----------------------------------------------------------------------
@router.post("/chat", response_model=ChatResponse)
async def assistant_chat(
    payload: ChatRequest,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> ChatResponse:
    await require_internal_key(request)

    if not _limiter.allow(f"user:{payload.user_id}"):
        tunggu = int(_limiter.retry_after_seconds(f"user:{payload.user_id}")) + 1
        raise HTTPException(
            status_code=429,
            detail=(
                f"Batas {settings.ASSISTANT_RATE_LIMIT_PER_HOUR} pertanyaan per jam "
                f"tercapai. Coba lagi dalam {tunggu} detik."
            ),
            headers={"Retry-After": str(tunggu)},
        )

    outlet_filter_id, outlet_name = await resolve_outlet(
        session, payload.outlet_id
    )

    tercache = _cache.get(
        payload.user_id, outlet_filter_id, payload.question
    )
    if tercache is not None:
        klien = get_llm_client()
        return ChatResponse(
            answer=tercache,
            mode="ai" if klien is not None else "data",
            intent=otak.classify_intent(payload.question),
            period=otak.extract_period(payload.question),
            numbers_validated=True,
            cached=True,
            retried=False,
            engine=klien.model if klien is not None else "offline",
            outlet_id=outlet_filter_id,
            outlet_name=outlet_name,
        )

    riwayat = await _muat_riwayat(session, payload.user_id, otak.HISTORY_TURNS)
    konteks = await build_data_context(session, outlet_filter_id, outlet_name)

    # Maksud + periode dihitung SEKALI — dipakai jalur Mode Data maupun
    # jatuh-darurat bila LLM tumbang di tengah jalan.
    maksud = otak.classify_intent(payload.question)
    periode = otak.extract_period(payload.question)

    klien = get_llm_client()
    try:
        hasil = await otak.generate_answer(
            payload.question, konteks, riwayat, klien
        )
    except Exception:
        # LLM tumbang (jaringan/penyedia) => Mode Data, asisten tetap hidup.
        hasil = {
            "answer": otak.build_offline_answer(konteks, maksud, periode),
            "mode": "data",
            "intent": maksud,
            "period": periode,
            "numbers_validated": True,
            "retried": False,
        }

    await _simpan_riwayat(
        session, payload.user_id, outlet_filter_id,
        payload.question, hasil["answer"],
    )

    if hasil["numbers_validated"]:
        _cache.put(
            payload.user_id, outlet_filter_id, payload.question, hasil["answer"]
        )

    return ChatResponse(
        answer=hasil["answer"],
        mode=hasil["mode"],
        intent=hasil["intent"],
        period=hasil["period"],
        numbers_validated=hasil["numbers_validated"],
        cached=False,
        retried=hasil["retried"],
        engine=klien.model if klien is not None else "offline",
        outlet_id=outlet_filter_id,
        outlet_name=outlet_name,
    )


@router.get("/history", response_model=HistoryResponse)
async def assistant_history(
    request: Request,
    user_id: int = Query(ge=1),
    limit: int = Query(default=20, ge=1, le=50),
    session: AsyncSession = Depends(get_session),
) -> HistoryResponse:
    await require_internal_key(request)
    baris = (
        await session.execute(
            select(ChatHistory)
            .where(ChatHistory.user_id == user_id)
            .order_by(ChatHistory.created_at.desc(), ChatHistory.id.desc())
            .limit(limit)
        )
    ).scalars().all()
    pesan = [
        ChatHistoryMessage(role=b.role, content=b.content, created_at=b.created_at)
        for b in reversed(baris)
    ]
    return HistoryResponse(messages=pesan, total=len(pesan))


@router.get("/status", response_model=AssistantStatus)
async def assistant_status() -> AssistantStatus:
    """PUBLIK tanpa key: kejujuran status lebih berguna daripada
    menyembunyikannya (konsol dev memeriksa mode tanpa sesi)."""
    klien = get_llm_client()
    return AssistantStatus(
        version=settings.VERSION,
        llm_configured=llm_configured(),
        llm_model=klien.model if klien is not None else None,
        mode="ai" if llm_configured() else "data",
        rate_limit_per_hour=settings.ASSISTANT_RATE_LIMIT_PER_HOUR,
        cache_seconds=settings.ASSISTANT_CACHE_SECONDS,
        ml_auto_train=settings.ML_AUTO_TRAIN,
        ml_auto_train_interval_hours=settings.ML_AUTO_TRAIN_INTERVAL_HOURS,
        ml_gate_min_days=ml_trainer.MIN_DAYS,
        ml_gate_min_nonzero=ml_trainer.MIN_NONZERO,
    )


# ----------------------------------------------------------------------
# Pengaturan LLM runtime (v3.2.0) — UI Pengaturan frontend
# ----------------------------------------------------------------------
def _llm_config_out() -> LlmConfigOut:
    """Bentuk respons pengaturan efektif (kunci selalu dimasker)."""
    cfg = effective_llm_config()
    klien = get_llm_client()
    aktif = klien is not None
    return LlmConfigOut(
        enabled=bool(cfg["enabled"]),
        base_url=cfg["base_url"],
        model=cfg["model"],
        api_key_masked=mask_key(cfg["api_key"]),
        source=cfg["source"],
        llm_configured=aktif,
        llm_model=klien.model if klien is not None else None,
        mode="ai" if aktif else "data",
    )


@router.get("/llm-config", response_model=LlmConfigOut)
async def get_llm_config(request: Request) -> LlmConfigOut:
    await require_internal_key(request)
    return _llm_config_out()


@router.put("/llm-config", response_model=LlmConfigOut)
async def put_llm_config(
    payload: LlmConfigIn, request: Request
) -> LlmConfigOut:
    """Simpan pengaturan LLM ke volume mlmodels — langsung berlaku.

    Validasi ditolak 422 (bukan 500) dengan pesan bahasa Indonesia
    supaya UI Pengaturan bisa menampilkannya apa adanya:
      - enabled=true  => base_url wajib http(s):// dan model terisi;
      - api_key BOLEH kosong (Ollama lokal tidak pakai kunci).
    """
    await require_internal_key(request)
    base = (payload.base_url or "").strip()
    kunci = (payload.api_key or "").strip()
    model = (payload.model or "").strip()

    if payload.enabled:
        if not (base.startswith("http://") or base.startswith("https://")):
            raise HTTPException(
                status_code=422,
                detail="Base URL harus berawalan http:// atau https:// "
                "(contoh: https://api.groq.com/openai/v1).",
            )
        if not model:
            raise HTTPException(
                status_code=422,
                detail="Nama model wajib diisi (contoh: llama-3.3-70b-versatile).",
            )

    save_file_config(base_url=base, api_key=kunci, model=model,
                     enabled=payload.enabled)
    return _llm_config_out()
