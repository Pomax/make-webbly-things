/**
 * ...docs go here...
 */
export function composeWhere(where, suffix = []) {
  let ua = where.updated_at;
  if (where.updated_at) delete where.updated_at;
  let filter = Object.entries(where)
    .map(([k, v]) => {
      if (v === null || v === undefined) {
        suffix.push(`${k} IS NULL`);
        return false;
      }
      return `${k} = ?`;
    })
    .filter(Boolean)
    .join(` AND `);
  if (suffix.length) filter += ` AND ${suffix.join(` AND `)}`;
  const values = Object.values(where).filter(
    (v) => !(v === undefined || v === null),
  );
  if (ua) where.updated_at = ua;
  return { filter, values };
}
