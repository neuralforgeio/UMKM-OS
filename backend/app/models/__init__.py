"""SQLAlchemy models mapped onto the EXISTING Prisma-owned tables.

The schema belongs to Prisma on the frontend side; this package only
mirrors it for read-only queries. Names follow the Prisma schema
verbatim (PascalCase tables, camelCase columns) because the schema
declares no @@map / @map directives.
"""

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum as SaEnum,
    Integer,
    Numeric,
    String,
)
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


payment_method_enum = SaEnum(
    "CASH", "QRIS", "DEBIT", name="PaymentMethod", native_enum=True
)
transaction_status_enum = SaEnum(
    "COMPLETED", "REFUNDED", name="TransactionStatus", native_enum=True
)


class Outlet(Base):
    __tablename__ = "Outlet"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    address = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    isActive = Column("isActive", Boolean, nullable=False)
    createdAt = Column("createdAt", DateTime, nullable=False)


class Product(Base):
    __tablename__ = "Product"

    id = Column(String, primary_key=True)
    sku = Column(String, nullable=False)
    name = Column(String, nullable=False)
    categoryId = Column("categoryId", String, nullable=True)
    outletId = Column("outletId", String, nullable=False)
    price = Column(Numeric(12, 2), nullable=False)
    cost = Column(Numeric(12, 2), nullable=False)
    stock = Column(Integer, nullable=False)
    minStock = Column("minStock", Integer, nullable=False)
    unit = Column(String, nullable=False)
    isActive = Column("isActive", Boolean, nullable=False)
    createdAt = Column("createdAt", DateTime, nullable=False)
    updatedAt = Column("updatedAt", DateTime, nullable=False)


class Transaction(Base):
    __tablename__ = "Transaction"

    id = Column(String, primary_key=True)
    code = Column(String, nullable=False)
    outletId = Column("outletId", String, nullable=False)
    cashierId = Column("cashierId", String, nullable=False)
    paymentMethod = Column("paymentMethod", payment_method_enum, nullable=False)
    status = Column(transaction_status_enum, nullable=False)
    subtotal = Column(Numeric(12, 2), nullable=False)
    discount = Column(Numeric(12, 2), nullable=False)
    total = Column(Numeric(12, 2), nullable=False)
    paidAmount = Column("paidAmount", Numeric(12, 2), nullable=False)
    changeAmount = Column("changeAmount", Numeric(12, 2), nullable=False)
    note = Column(String, nullable=True)
    createdAt = Column("createdAt", DateTime, nullable=False)


class TransactionItem(Base):
    __tablename__ = "TransactionItem"

    id = Column(String, primary_key=True)
    transactionId = Column("transactionId", String, nullable=False)
    productId = Column("productId", String, nullable=False)
    quantity = Column(Integer, nullable=False)
    priceAtSale = Column("priceAtSale", Numeric(12, 2), nullable=False)
    subtotal = Column(Numeric(12, 2), nullable=False)
