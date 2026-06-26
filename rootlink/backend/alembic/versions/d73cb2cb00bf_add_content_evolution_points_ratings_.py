"""add_content_evolution_points_ratings_feeds

Revision ID: d73cb2cb00bf
Revises: dcc715421a5e
Create Date: 2026-06-26 16:57:01.324099

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd73cb2cb00bf'
down_revision: Union[str, Sequence[str], None] = 'dcc715421a5e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('feed_sources',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('feed_url', sa.String(length=2000), nullable=False),
        sa.Column('site_url', sa.String(length=2000), nullable=True),
        sa.Column('title', sa.String(length=500), nullable=True),
        sa.Column('verified', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('verification_token', sa.String(length=255), nullable=True),
        sa.Column('verification_method', sa.String(length=50), nullable=True),
        sa.Column('last_crawled_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_error', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('priority', sa.Integer(), nullable=False, server_default='2'),
        sa.Column('auto_sync', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_feed_sources_user_id'), 'feed_sources', ['user_id'], unique=False)

    op.create_table('point_balances',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('balance', sa.Float(), nullable=False, server_default='0'),
        sa.Column('total_donated', sa.Float(), nullable=False, server_default='0'),
        sa.Column('last_decay_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_point_balances_user_id'), 'point_balances', ['user_id'], unique=True)

    op.create_table('point_transactions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('reason', sa.String(length=50), nullable=False),
        sa.Column('reference_id', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_point_transactions_user_id'), 'point_transactions', ['user_id'], unique=False)

    op.create_table('content_ratings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('content_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('reaction', sa.String(length=10), nullable=False),
        sa.Column('tags', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.ForeignKeyConstraint(['content_id'], ['content.id']),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('content_id', 'user_id', name='uq_rating_user_content'),
    )
    op.create_index(op.f('ix_content_ratings_content_id'), 'content_ratings', ['content_id'], unique=False)

    op.create_table('feed_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('feed_source_id', sa.Integer(), nullable=False),
        sa.Column('guid', sa.String(length=2000), nullable=False),
        sa.Column('url', sa.String(length=2000), nullable=False),
        sa.Column('title', sa.String(length=500), nullable=False),
        sa.Column('content_id', sa.Integer(), nullable=True),
        sa.Column('ingested', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('skipped_reason', sa.String(length=500), nullable=True),
        sa.ForeignKeyConstraint(['content_id'], ['content.id']),
        sa.ForeignKeyConstraint(['feed_source_id'], ['feed_sources.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_feed_items_feed_source_id'), 'feed_items', ['feed_source_id'], unique=False)

    with op.batch_alter_table('content') as batch_op:
        batch_op.create_unique_constraint('uq_content_slug', ['slug'])
        batch_op.create_foreign_key('fk_content_feed_source', 'feed_sources', ['feed_source_id'], ['id'])

    op.execute("UPDATE content SET status = 'published' WHERE status = 'draft' AND published_at IS NOT NULL")

    op.add_column('users', sa.Column('feed_url', sa.String(length=2000), nullable=True))
    op.add_column('users', sa.Column('feed_verified', sa.Boolean(), nullable=False, server_default='0'))
    op.add_column('users', sa.Column('feed_verification_token', sa.String(length=255), nullable=True))
    op.add_column('users', sa.Column('feed_last_crawled_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('users', sa.Column('feed_priority', sa.Integer(), nullable=False, server_default='3'))
    op.add_column('users', sa.Column('boost_active', sa.Boolean(), nullable=False, server_default='0'))
    op.add_column('users', sa.Column('boost_expires_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'boost_expires_at')
    op.drop_column('users', 'boost_active')
    op.drop_column('users', 'feed_priority')
    op.drop_column('users', 'feed_last_crawled_at')
    op.drop_column('users', 'feed_verification_token')
    op.drop_column('users', 'feed_verified')
    op.drop_column('users', 'feed_url')

    with op.batch_alter_table('content') as batch_op:
        batch_op.drop_constraint('fk_content_feed_source', type_='foreignkey')
        batch_op.drop_constraint('uq_content_slug', type_='unique')

    op.drop_index(op.f('ix_feed_items_feed_source_id'), table_name='feed_items')
    op.drop_table('feed_items')
    op.drop_index(op.f('ix_content_ratings_content_id'), table_name='content_ratings')
    op.drop_table('content_ratings')
    op.drop_index(op.f('ix_point_transactions_user_id'), table_name='point_transactions')
    op.drop_table('point_transactions')
    op.drop_index(op.f('ix_point_balances_user_id'), table_name='point_balances')
    op.drop_table('point_balances')
    op.drop_index(op.f('ix_feed_sources_user_id'), table_name='feed_sources')
    op.drop_table('feed_sources')
