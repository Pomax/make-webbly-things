import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { resolve, join } from "node:path";
import * as Docker from "../../../server/docker/docker-helpers.js";

import dotenv from "@dotenvx/dotenvx";
const envPath = resolve(
  join(import.meta.dirname, `..`, `..`, `..`, `..`, `.env`)
);
dotenv.config({ quiet: true, path: envPath });

/*
export function checkContainerHealth(project, slug = project.slug) {
export function deleteContainer(project, slug = project.slug) {
export function deleteContainerAndImage(project) {
export function getAllRunningContainers() {
export function getAllRunningStaticServers() {
export function renameContainer(oldSlug, newSlug) {
export async function restartContainer(project, rebuild = false) {
export async function runStaticSite(project) {
export async function runContainer(project) {
export function stopContainer(project, slug = project.slug) {
export function stopStaticServer(project, slug = project.slug) {
*/

describe(`docker tests`, async () => {
  test(`checkContainerHealth`, () => {
    // tests pending
  });
});
