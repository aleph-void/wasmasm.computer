/**
 * Manual mock for src/historyDb.js.
 *
 * Wired up via moduleNameMapper in jest.config.js so that every
 * `import { ... } from '../historyDb'` in source code resolves to this file.
 *
 * Tests import these functions directly to inspect calls and control return values.
 */

export const saveEntry   = jest.fn().mockResolvedValue(1)
export const loadAll     = jest.fn().mockResolvedValue([])
export const deleteEntry = jest.fn().mockResolvedValue(undefined)
export const clearAll    = jest.fn().mockResolvedValue(undefined)
