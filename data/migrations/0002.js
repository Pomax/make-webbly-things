// -- Schema v3

/**
 * This migration adds a new users.slug column, which needs to
 * be a unique, not-null text value equal to the name column, as
 * run through our "slugify" function so it bcomes a URL-safe value
 */
export default async function update(data, { slugify }) {
  // extend the user schema
  const tableStart = data.indexOf(`CREATE TABLE users`);
  const createdAt = data.indexOf(`  created_at`, tableStart);
  const newField = `  slug TEXT NOT NULL UNIQUE,\n`;
  data = data.substring(0, createdAt) + newField + data.substring(createdAt);

  // and then update all the user inserts
  const re = /INSERT INTO users VALUES\(\d+,'([^']+)',[^\)]+\);/g;
  data = data.replace(re, (full, name) =>
    full.replace(`'${name}'`, `'${name}','${slugify(name)}'`)
  );

  // and finally, make sure to add a new index, too.
  const index = `CREATE INDEX user_names ON users(name);\n`;
  const indexPos = data.indexOf(index) + index.length;
  const newIndex = `CREATE INDEX user_slugs ON users(slug);\n`;
  data = data.substring(0, indexPos) + newIndex + data.substring(indexPos);

  // And then we're done here. Note that the `user_version`
  // pragma automatically gets appended, so we don't add
  // that here, the `migrate()` function does that for us.
  return data;
}
