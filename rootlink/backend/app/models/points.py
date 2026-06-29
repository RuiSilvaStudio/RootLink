from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class PointBalance(TimestampMixin, Base):
    __tablename__ = "point_balances"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, index=True)
    balance: Mapped[float] = mapped_column(Float, default=0.0)
    total_donated: Mapped[float] = mapped_column(Float, default=0.0)
    last_decay_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class PointTransaction(TimestampMixin, Base):
    __tablename__ = "point_transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    amount: Mapped[float] = mapped_column(Float)
    reason: Mapped[str] = mapped_column(String(50))
    reference_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
