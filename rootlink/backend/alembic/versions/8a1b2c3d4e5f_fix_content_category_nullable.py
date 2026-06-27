"""fix content.category to match model (nullable, wider type)

Revision ID: 8a1b2c3d4e5f
Revises: 0cb0749e898a
Create Date: 2026-06-27 17:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '8a1b2c3d4e5f'
down_revision: Union[str, Sequence[str], None] = '0cb0749e898a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('content') as batch_op:
        batch_op.alter_column('category',
               existing_type=sa.VARCHAR(length=12),
               type_=sa.String(length=100),
               nullable=True,
               existing_nullable=False)
        batch_op.alter_column('status',
               type_=sa.VARCHAR(length=20),
               server_default="draft")
        batch_op.alter_column('verification_status',
               type_=sa.VARCHAR(length=50),
               server_default="unreviewed")


def downgrade() -> None:
    with op.batch_alter_table('content') as batch_op:
        batch_op.alter_column('category',
               existing_type=sa.String(length=100),
               type_=sa.VARCHAR(length=12),
               nullable=False,
               existing_nullable=True)
