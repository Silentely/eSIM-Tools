import { getClosestElement } from '../../src/js/modules/utils.js';

describe('getClosestElement()', () => {
  test('returns the matching ancestor for an Element target', () => {
    document.body.innerHTML = '<div class="action"><span id="child"></span></div>';

    expect(getClosestElement(document.getElementById('child'), '.action')).toBe(
      document.querySelector('.action')
    );
  });

  test('ignores non-Element event targets without throwing', () => {
    expect(getClosestElement(document, '.action')).toBeNull();
    expect(getClosestElement(null, '.action')).toBeNull();
  });
});
