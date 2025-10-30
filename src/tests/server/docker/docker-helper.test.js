import { describe } from "node:test";
import { resolve, join } from "node:path";
import { ROOT_DIR } from "../../../helpers.js";
import dotenv from "@dotenvx/dotenvx";
const envPath = resolve(join(ROOT_DIR, `.env`));
dotenv.config({ quiet: true, path: envPath });

/*
export function checkContainerHealth(project, slug = project.slug) {
export function deleteContainer(project, slug = project.slug) {
export function deleteContainerAndImage(project) {
export function getAllRunningContainers() {
export function getAllRunningStaticServers() {
export function renameContainer(oldSlug, newSlug) {
export async function restartContainer(project, rebuild = false) {
export async function runStaticServer(project) {
export async function runContainer(project) {
export function stopContainer(project, slug = project.slug) {
export function stopStaticServer(project, slug = project.slug) {
*/

describe(`docker tests`, async () => {
  // tests pending
});
