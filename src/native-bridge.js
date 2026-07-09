// Bundled separately from index.html (which stays plain React.createElement, no build step)
// because Capacitor plugins are published as ES modules that call registerPlugin() from
// @capacitor/core — that needs a bundler to run in a plain <script> tag context.
// This file's only job is to expose window.CapacitorHealth so index.html can call it
// as a normal global, same as it already does with window.Capacitor (auto-injected natively).
import { Health } from 'capacitor-health';

window.CapacitorHealth = Health;
