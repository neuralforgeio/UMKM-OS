"""SQLAlchemy models mapped onto the GO-owned tables (snake_case).

Sejak integrasi Tahap 4a, schema PostgreSQL dimiliki backend-go (lihat
backend-go/internal/db/db.go — tabel users, products, transactions,
transaction_items, dst). Layanan ML tetap READ-ONLY: tidak pernah
membuat/mengubah tabel apa pun; paket ini hanya memetakan kolom untuk
query analitik. Uang disimpan Go sebagai BIGINT Rupiah utuh (bukan
Numeric desimal era Prisma).

v2.1.0 menutup era Prisma: tabel PascalCase ("Outlet", "User", dst)
sudah di-DROP backend-go. Identitas outlet kini dibaca dari tabel
"outlets" milik Go (id BIGINT) — satu-satunya sisa transisi pun hilang;
layanan ini murni membaca dunia Go.

v3.1.0 — SATU pengecualian tulis: chat_history (DDL tetap migrasi #12
milik backend-go). Layanan ML menyimpan dua baris per percakapan (USER
lalu ASSISTANT) lewat gerbang X-Internal-Key; seluruh tabel lain tetap
baca-saja.
"""

from datetime import datetime, timezone

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    Integer,
    String,
)
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class Outlet(Base):
    """Identitas warung milik backend-go (tabel outlets, id BIGINT)."""

    __tablename__ = "outlets"

    id = Column(BigInteger, primary_key=True)
    name = Column(String, nullable=False)
    address = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False)


class Product(Base):
    __tablename__ = "products"

    id = Column(BigInteger, primary_key=True)
    name = Column(String, nullable=False)
    sku = Column(String, nullable=True)
    category = Column(String, nullable=False)
    price = Column(BigInteger, nullable=False)   # Rupiah utuh
    cost = Column(BigInteger, nullable=False)    # Rupiah utuh
    stock = Column(Integer, nullable=False)
    min_stock = Column(Integer, nullable=False)
    unit = Column(String, nullable=False)
    is_active = Column(Boolean, nullable=False)
    # Outlet pemilik produk — kolom migrasi Go (backfill dari outlet
    # kasir pertama); NULL hanya pada baris pra-migrasi.
    outlet_id = Column(BigInteger, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False)
    updated_at = Column(DateTime(timezone=True), nullable=False)


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(BigInteger, primary_key=True)
    receipt_no = Column(String, nullable=False)
    cashier_id = Column(BigInteger, nullable=False)
    subtotal = Column(BigInteger, nullable=False)
    discount = Column(BigInteger, nullable=False)
    total = Column(BigInteger, nullable=False)
    payment_method = Column(String, nullable=False)  # CASH / QRIS / DEBIT
    paid_amount = Column(BigInteger, nullable=False)
    change_amount = Column(BigInteger, nullable=False)
    status = Column(String, nullable=False)          # COMPLETED
    # Outlet tempat transaksi terjadi — Go MENULIS kolom ini saat
    # INSERT (transaction.go) dan memakainya di seluruh laporan
    # per-outlet; layanan ML membaca kolom yang sama.
    outlet_id = Column(BigInteger, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False)


class TransactionItem(Base):
    __tablename__ = "transaction_items"

    id = Column(BigInteger, primary_key=True)
    transaction_id = Column(BigInteger, nullable=False)
    product_id = Column(BigInteger, nullable=False)
    product_name = Column(String, nullable=False)    # snapshot saat jual
    price = Column(BigInteger, nullable=False)
    qty = Column(Integer, nullable=False)
    subtotal = Column(BigInteger, nullable=False)


class ChatHistory(Base):
    """Riwayat percakapan Asisten AI (v3.1.0).

    DDL: migrasi #12 backend-go (v1.8.0). Satu-satunya tabel yang
    DITULIS layanan ML — lihat docstring modul. Baris ditulis ber-
    pasangan (USER lalu ASSISTAN) per percakapan; index Go
    idx_chat_history_user_time melayani panel riwayat.
    """

    __tablename__ = "chat_history"

    id = Column(BigInteger, primary_key=True)
    user_id = Column(BigInteger, nullable=False)
    outlet_id = Column(BigInteger, nullable=True)
    role = Column(String, nullable=False)           # USER / ASSISTANT
    content = Column(String, nullable=False)
    # v3.1.1: default Python — penulis baru tidak perlu mengingat
    # mengisi kolom ini: ORM 2.1 merender kolom tanpa nilai sebagai NULL
    # eksplisit (bukan membiarkan DEFAULT database bekerja).
    created_at = Column(
        DateTime(timezone=True), nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
