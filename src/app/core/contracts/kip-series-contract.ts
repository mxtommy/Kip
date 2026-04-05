/**
 * Ownership: shared app/plugin boundary contract.
 *
 * This re-export intentionally points to the plugin package contract so app and plugin share
 * one authoritative series schema. Keep this in `core/contracts`.
 */
export * from '../../../../kip-plugin/src/kip-series-contract';
