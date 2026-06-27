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
    # SQLite batch mode chokes on the unquoted DEFAULT draft for status.
    # Manually recreate the table with properly quoted defaults.
    op.execute("PRAGMA foreign_keys=OFF")
    op.execute("""
        CREATE TABLE content_new (
            id INTEGER NOT NULL,
            title VARCHAR(500) NOT NULL,
            url VARCHAR(2000),
            content_type VARCHAR(7) NOT NULL,
            category VARCHAR(100),
            full_text TEXT,
            summary TEXT,
            embedding JSON,
            image_url VARCHAR(2000),
            source VARCHAR(7) NOT NULL,
            source_url VARCHAR(2000),
            created_by INTEGER,
            published_at DATETIME,
            crawled_at DATETIME,
            validated_by INTEGER,
            created_at DATETIME DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
            updated_at DATETIME DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
            verification_status VARCHAR DEFAULT 'unreviewed',
            cross_referenced_sources JSON,
            family VARCHAR(50),
            slug VARCHAR(500),
            body JSON,
            status VARCHAR(20) DEFAULT 'draft',
            edited_at DATETIME,
            canonical_url VARCHAR(2000),
            feed_source_id INTEGER,
            rating_up INTEGER DEFAULT 0,
            rating_down INTEGER DEFAULT 0,
            view_count INTEGER DEFAULT 0,
            comment_count INTEGER DEFAULT 0,
            bookmark_count INTEGER DEFAULT 0,
            PRIMARY KEY (id),
            FOREIGN KEY(created_by) REFERENCES users (id),
            FOREIGN KEY(validated_by) REFERENCES users (id)
        )
    """)
    op.execute("INSERT INTO content_new SELECT * FROM content")
    op.execute("DROP TABLE content")
    op.execute("ALTER TABLE content_new RENAME TO content")
    op.execute("PRAGMA foreign_keys=ON")


def downgrade() -> None:
    op.execute("PRAGMA foreign_keys=OFF")
    op.execute("""
        CREATE TABLE content_old (
            id INTEGER NOT NULL,
            title VARCHAR(500) NOT NULL,
            url VARCHAR(2000),
            content_type VARCHAR(7) NOT NULL,
            category VARCHAR(12) NOT NULL,
            full_text TEXT,
            summary TEXT,
            embedding JSON,
            image_url VARCHAR(2000),
            source VARCHAR(7) NOT NULL,
            source_url VARCHAR(2000),
            created_by INTEGER,
            published_at DATETIME,
            crawled_at DATETIME,
            validated_by INTEGER,
            created_at DATETIME DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
            updated_at DATETIME DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
            verification_status VARCHAR DEFAULT 'unreviewed',
            cross_referenced_sources JSON,
            family VARCHAR(50),
            slug VARCHAR(500),
            body JSON,
            status VARCHAR(20) DEFAULT (draft),
            edited_at DATETIME,
            canonical_url VARCHAR(2000),
            feed_source_id INTEGER,
            rating_up INTEGER DEFAULT 0,
            rating_down INTEGER DEFAULT 0,
            view_count INTEGER DEFAULT 0,
            comment_count INTEGER DEFAULT 0,
            bookmark_count INTEGER DEFAULT 0,
            PRIMARY KEY (id),
            FOREIGN KEY(created_by) REFERENCES users (id),
            FOREIGN KEY(validated_by) REFERENCES users (id)
        )
    """)
    op.execute("INSERT INTO content_old SELECT * FROM content")
    op.execute("DROP TABLE content")
    op.execute("ALTER TABLE content_old RENAME TO content")
    op.execute("PRAGMA foreign_keys=ON")
