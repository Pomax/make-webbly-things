import test from "node:test";
import assert from "node:assert/strict";
import { resolve, join } from "node:path";
import * as User from "../../../server/database/user.js";

import dotenv from "@dotenvx/dotenvx";
const envPath = resolve(
  join(import.meta.dirname, `..`, `..`, `..`, `..`, `.env`)
);
dotenv.config({ quiet: true, path: envPath });

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
  assert.equal(users.length > 0, true);
});

// TODO: we need to set up a testing database rather than use the real one =)
