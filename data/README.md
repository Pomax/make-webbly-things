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
