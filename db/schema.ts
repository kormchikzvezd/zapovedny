import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const leads = sqliteTable('leads', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  name: text('name'),
  phone: text('phone').notNull(),
  preferredChannel: text('preferred_channel').notNull(),
  messengerHandle: text('messenger_handle'),
  homes: text('homes'),
  consentAt: text('consent_at').notNull(),
});
