'use client'

import {
  PoolMigrationPage,
  PoolPathProps,
} from '@repo/lib/modules/pool/migrations/PoolMigrationPage'

export default function MigratePoolClient({ chain, id, variant }: PoolPathProps) {
  return <PoolMigrationPage chain={chain} id={id} variant={variant} />
}
