import '@testing-library/jest-dom';

// jsdom does not implement scrollIntoView — mock it globally so
// components that call ref.scrollIntoView() don't crash in tests.
window.HTMLElement.prototype.scrollIntoView = vi.fn();

// Also mock scrollTo which is sometimes called alongside scrollIntoView
window.scrollTo = vi.fn();
