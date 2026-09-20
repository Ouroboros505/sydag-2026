/** Local-first storage. Everything stays in the browser's IndexedDB on the device.
 *
 * Add tables as the track demands; bump the version number when the schema changes.
 */
import Dexie, { type EntityTable } from 'dexie'

export interface Record {
  id?: number
  at: string
}

export const db = new Dexie('sydag') as Dexie & {
  records: EntityTable<Record, 'id'>
}

db.version(1).stores({
  records: '++id, at',
})
