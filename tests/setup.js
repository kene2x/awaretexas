// Test setup and configuration
const { initializeFirebase } = require('../config/firebase');

// Mock Firebase for testing
jest.mock('../config/firebase', () => ({
  initializeFirebase: jest.fn(() => ({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn(),
        set: jest.fn(),
        update: jest.fn(),
        delete: jest.fn()
      })),
      add: jest.fn(),
      where: jest.fn(() => ({
        get: jest.fn()
      }))
    }))
  })),
  admin: {
    firestore: {
      FieldValue: {
        serverTimestamp: jest.fn()
      }
    }
  }
}));

module.exports = {};