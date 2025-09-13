To set up the database, run `node setup`.

# git diffing

If you want to diff sqlite3 databases, you may want to add the following to your git configuration:

```
git config --local diff.sqlite3.binary true
git config --local diff.sqlite3.textconv "echo .dump | sqlite3"
```

While the code already does this, if you want to do any sqlite3 debugging, remember to always start your sessions with `PRAGMA foreign_keys = ON;` just in case.

# Testing

the `test.sqlite` database is a preconfigured database for running the unit and integration tests.

If you write new migrations, make sure to apply those to the test database using the sqlite3 CLI and the `.read` instruction. A migration PR should include an updated test.sqlite3!

# pre-migration backups

Whenever a complex migration is required, i.e. a JS migration rather than a straight SQL uplift, the code will create a backup of your database before migrating. For example, when 0002.js gets run to uplift the database from schema v2 to schema v3, it will first create a `v2.data.sqlite` and `v2.test.sqlite`. These are safe to delete in production, but you really want them during development if you're working on anything that requires complex schema uplifts =)
