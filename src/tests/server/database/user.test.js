import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import { resolve, join } from "node:path";
import * as User from "../../../server/database/user.js";
import {
  initTestDatabase,
  concludeTesting,
} from "../../../server/database/models.js";

import dotenv from "@dotenvx/dotenvx";
const envPath = resolve(
  join(import.meta.dirname, `..`, `..`, `..`, `..`, `.env`)
);
dotenv.config({ quiet: true, path: envPath });

describe(`user tests`, async () => {
  before(async () => await initTestDatabase());
  after(() => concludeTesting());

  /*
  export function processUserLogin(userObject) {
  export function deleteUser(userId) {
  export function disableUser(userNameOrId) {
  export function enableUser(userNameOrId) {
  export function getAllUsers() {
  export function getUser(userNameOrId) {
  export function getUserAdminFlag(userName) {
  export function getUserId(userName) {
  export function getUserSettings(userId) {
  export function getUserSuspensions(userNameOrId, includeOld = false) {
  export function hasAccessToUserRecords(sessionUserId, lookupUserId) {
  export function suspendUser(userNameOrId, reason, notes = ``) {
  export function unsuspendUser(suspensionId) {
  */

  test(`getAllUsers`, () => {
    const users = User.getAllUsers();
    assert.equal(users.length, 2);
  });
});
