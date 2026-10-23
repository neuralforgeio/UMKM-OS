"""SQLAlchemy models mapped onto the GO-owned tables (snake_case).

Sejak integrasi Tahap 4a, schema PostgreSQL dimiliki backend-go (lihat
backend-go/internal/db/db.go — tabel users, products, transactions,
transaction_items, dst). Layanan ML tetap READ-ONLY: tidak pernah
membuat/mengubah tabel apa pun; paket ini hanya memetakan kolom untuk
query analitik. Uang disimpan Go sebagai BIGINT Rupiah utuh (bukan
Numeric desimal era Prisma).

Satu pengecualian transisi: tabel "Outlet" era Prisma masih dipakai
frontend sebagai identitas warung (nama/logo) sampai fase multi-outlet
memindahkannya ke Go — nama outlet ikut terbaca di sini supaya respons
tetap punya konteks "milik warung siapa".
"""

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
    """Identitas warung era Prisma — hanya nama yang dipakai (transisi)."""

    __tablename__ = "Outlet"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    address = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    isActive = Column("isActive", Boolean, nullable=False)
    createdAt = Column("createdAt", DateTime, nullable=False)


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
