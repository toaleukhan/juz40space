import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import Sidebar, { RAIL_WIDTH, RAIL_WIDTH_EXPANDED } from './Sidebar';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Бөлімге басқанда бет ауысып, Sidebar қайта mount болады. Тінтуір әлі
// панель үстінде тұрса — панель ашық қалуы керек (бұрын бірден жабылатын).
describe('Sidebar ашылу/жабылу', () => {
  let host;
  let root;
  const mount = () => act(() => {
    root = createRoot(host);
    root.render(createElement(MemoryRouter, null, createElement(Sidebar)));
  });
  const panel = () => host.querySelector('aside');
  const widthOf = () => parseInt(panel().style.width, 10);
  const fire = (el, type) => act(() => { el.dispatchEvent(new MouseEvent(type, { bubbles: type !== 'mouseleave' && type !== 'mouseenter' })); });

  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(window, 'innerWidth', { value: 1440, configurable: true });
    window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
    host = document.createElement('div');
    document.body.appendChild(host);
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.useRealTimers();
  });

  it('тінтуір келгенде ашылады, кеткенде сәл кешігіп жабылады', () => {
    mount();
    expect(widthOf()).toBe(RAIL_WIDTH);
    fire(panel(), 'mouseover');
    expect(widthOf()).toBe(RAIL_WIDTH_EXPANDED);
    fire(panel(), 'mouseout');
    expect(widthOf()).toBe(RAIL_WIDTH_EXPANDED);
    act(() => { vi.advanceTimersByTime(200); });
    expect(widthOf()).toBe(RAIL_WIDTH);
  });

  it('бет ауысқанда (қайта mount) тінтуір үстінде болса — ашық қалады', () => {
    mount();
    fire(panel(), 'mouseover');
    expect(widthOf()).toBe(RAIL_WIDTH_EXPANDED);
    act(() => root.unmount());
    mount();
    expect(widthOf()).toBe(RAIL_WIDTH_EXPANDED);
    // тінтуір шынымен сыртта қозғалса — жабылады
    act(() => { document.body.dispatchEvent(new MouseEvent('mousemove', { bubbles: true })); });
    act(() => { vi.advanceTimersByTime(200); });
    expect(widthOf()).toBe(RAIL_WIDTH);
  });
});
