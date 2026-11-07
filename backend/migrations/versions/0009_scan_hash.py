"""file fingerprint of an uploaded scan, to spot the same file uploaded twice

Revision ID: 0009
Revises: 0008
"""
from alembic import op
import sqlalchemy as sa


revision = '0009'
down_revision = '0008'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('legacy_imports', schema=None) as batch_op:
        batch_op.add_column(sa.Column('sha256', sa.String(), nullable=False, server_default=''))
        batch_op.create_index('ix_legacy_imports_sha256', ['sha256'])


def downgrade() -> None:
    with op.batch_alter_table('legacy_imports', schema=None) as batch_op:
        batch_op.drop_index('ix_legacy_imports_sha256')
        batch_op.drop_column('sha256')
