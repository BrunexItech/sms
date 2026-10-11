"""organisation registration number

Revision ID: 0003
Revises: 0002
"""
from alembic import op
import sqlalchemy as sa


revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('applications', schema=None) as batch_op:
        batch_op.add_column(sa.Column('org_reg_no', sa.String(), nullable=False, server_default=''))


def downgrade() -> None:
    with op.batch_alter_table('applications', schema=None) as batch_op:
        batch_op.drop_column('org_reg_no')
