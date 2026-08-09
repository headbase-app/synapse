import {vi} from "vitest"
import { ILogger } from "../../src/logger.js"

/**
 * Mock logger to remove all logging except errors during tests.
 */
class MockLogger implements ILogger {
    error = (label: string, message: string, context?: any) => {
      console.error(label, message, context)
    }
    warn = () => {}
    info = () => {}
    debug = () => {}
}
const mockLogger = new MockLogger()

// @ts-ignore --- vi.mock seems to be picking up type of protected properties
vi.mock(import('../../src/logger'), () => {
  return {
    logger: mockLogger,
  }
})
