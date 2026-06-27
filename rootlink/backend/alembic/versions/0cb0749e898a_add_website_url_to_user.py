"""add_website_url_to_user

Revision ID: 0cb0749e898a
Revises: d73cb2cb00bf
Create Date: 2026-06-27 17:26:52.051988

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0cb0749e898a'
down_revision: Union[str, Sequence[str], None] = 'd73cb2cb00bf'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('website_url', sa.String(length=2000), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'website_url')
