module.exports = {
  divIcon: jest.fn().mockImplementation((opts) => ({ ...opts, options: opts })),
  icon: jest.fn().mockImplementation((opts) => ({ ...opts, options: opts })),
  point: jest.fn().mockImplementation((x, y) => ({ x, y })),
  latLng: jest.fn().mockImplementation((lat, lng) => ({ lat, lng }))
};
