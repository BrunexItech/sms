"""paper-record imports and the legacy flag

Revision ID: 0007
Revises: 0006
"""
from alembic import op
import sqlalchemy as sa


revision = '0007'
down_revision = '0006'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'legacy_imports',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('doc_type', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False, server_default='Pending'),
        sa.Column('file_name', sa.String(), nullable=False, server_default=''),
        sa.Column('mime', sa.String(), nullable=False, server_default=''),
        sa.Column('size', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('path', sa.String(), nullable=False, server_default=''),
        sa.Column('fields', sa.JSON(), nullable=True),
        sa.Column('ocr', sa.JSON(), nullable=True),
        sa.Column('application_id', sa.String(), nullable=True),
        sa.Column('note', sa.String(), nullable=False, server_default=''),
        sa.Column('created_by', sa.String(), nullable=False, server_default=''),
        sa.Column('created_at', sa.String(), nullable=False, server_default=''),
        sa.Column('updated_at', sa.String(), nullable=False, server_default=''),
    )
    op.create_index('ix_legacy_imports_status', 'legacy_imports', ['status'])
    with op.batch_alter_table('applications', schema=None) as batch_op:
        batch_op.add_column(sa.Column('legacy', sa.Boolean(), nullable=False, server_default=sa.false()))
        batch_op.add_column(sa.Column('legacy_cert_no', sa.String(), nullable=False, server_default=''))


def downgrade() -> None:
    with op.batch_alter_table('applications', schema=None) as batch_op:
        batch_op.drop_column('legacy_cert_no')
        batch_op.drop_column('legacy')
    op.drop_index('ix_legacy_imports_status', table_name='legacy_imports')
    op.drop_table('legacy_imports')
