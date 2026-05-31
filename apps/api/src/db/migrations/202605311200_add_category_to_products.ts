import type { Knex } from 'knex';

/**
 * Ajoute une catégorie aux produits pour permettre le filtrage du catalogue.
 *
 * `category` est NOT NULL avec un défaut 'autre' (cf. CLAUDE.md règle #5 :
 * NOT NULL par défaut) → les lignes existantes deviennent valides sans
 * nullabilité. La valeur est contrôlée côté application par un enum Zod
 * (ProductCategorySchema), pas par un CHECK SQL, afin de pouvoir faire
 * évoluer la liste sans migration.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('products', (table) => {
    table.string('category', 50).notNullable().defaultTo('autre');
    table.index(['category'], 'products_category_idx');
  });

  // Backfill des données de démo : on cible par NOM d'organisation (les UUID
  // sont aléatoires au seed). Idempotent et sans effet sur de vraies orgs.
  await knex('products')
    .whereIn(
      'organization_id',
      knex('organizations').select('id').where('name', "Tissus d'Aya"),
    )
    .update({ category: 'tissus' });

  await knex('products')
    .whereIn(
      'organization_id',
      knex('organizations').select('id').where('name', 'Épices du Marché'),
    )
    .update({ category: 'epices' });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('products', (table) => {
    table.dropIndex(['category'], 'products_category_idx');
    table.dropColumn('category');
  });
}
