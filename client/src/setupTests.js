import '@testing-library/jest-dom';

// Global mocks for browser APIs missing in jsdom
global.fetch = jest.fn();

// Mock geolocation
const mockGeolocation = {
  getCurrentPosition: jest.fn().mockImplementation((success) =>
    success({
      coords: {
        latitude: 13.0827,
        longitude: 80.2707
      }
    })
  ),
  watchPosition: jest.fn()
};
global.navigator.geolocation = mockGeolocation;

// Mock window.scrollIntoView
Element.prototype.scrollIntoView = jest.fn();
