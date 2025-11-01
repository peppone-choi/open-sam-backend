
declare global {
  interface Function {
    getName(): string;
  }
}

if (!Function.prototype.hasOwnProperty('getName')) {
  Object.defineProperty(Function.prototype, 'getName', {
    value: function() { return this.name || 'anonymous'; },
    writable: false,
    configurable: true
  });
}

export {};
