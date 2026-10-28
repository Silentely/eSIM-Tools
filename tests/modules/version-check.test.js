import {
  checkForUpdates,
  getCurrentBuildVersion
} from '../../src/js/version-check.js';

describe('version check', () => {
  let windowRef;

  beforeEach(() => {
    document.documentElement.lang = 'zh-CN';
    document.head.innerHTML = '<meta name="build-rev" content="old-version">';
    document.body.innerHTML = '';
    windowRef = { location: { reload: jest.fn() } };
  });

  test('reads the build version from the page metadata', () => {
    expect(getCurrentBuildVersion(document)).toBe('old-version');
  });

  test('shows a refresh notice when a newer version is available', async () => {
    await checkForUpdates({
      documentRef: document,
      windowRef,
      fetchImpl: jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ version: 'new-version' })
      })
    });

    const notice = document.getElementById('esim-tools-update-notice');
    expect(notice).not.toBeNull();
    expect(notice.textContent).toContain('更新');

    notice.querySelector('button').click();
    expect(windowRef.location.reload).toHaveBeenCalledTimes(1);
  });

  test('does not show a notice when the page is current', async () => {
    await checkForUpdates({
      documentRef: document,
      windowRef,
      fetchImpl: jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ version: 'old-version' })
      })
    });

    expect(document.getElementById('esim-tools-update-notice')).toBeNull();
  });
});
