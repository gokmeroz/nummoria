// backend/src/utils/ensureIndex.js
//
// Some guarantees live in a unique index (idempotent imports, recurring
// occurrences booked once). Production runs with autoIndex off
// (config/db.js), so a code path that RELIES on such an index makes sure it
// exists before its first write. createIndex is a no-op when the index is
// already there; the promise is cached per process and cleared on failure.
const pending = new Map();

export function ensureIndexOnce(model, spec, options) {
  const key = `${model.collection.collectionName}:${JSON.stringify(spec)}`;
  if (!pending.has(key)) {
    pending.set(
      key,
      model.collection.createIndex(spec, options).catch((err) => {
        pending.delete(key);
        throw err;
      }),
    );
  }
  return pending.get(key);
}
