import "@testing-library/jest-dom/vitest";

// Mock browser scrolling for jsdom
window.scrollTo = () => { };

Element.prototype.scrollTo = () => { };