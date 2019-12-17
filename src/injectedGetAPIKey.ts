import 'core-js/stable';
import 'regenerator-runtime/runtime';
import { parse } from 'cookie';
import { browser } from 'webextension-polyfill-ts';

const getNewToken = async (): Promise<void> => {
  const data = await (
    await fetch('/oauth/personal-access-tokens', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Convert Download',
        scopes: ['user.read', 'task.read', 'task.write'],
        errors: []
      }),
      credentials: 'include',
      headers: {
        Accept: 'application/json, text/plain, */*',
        'Content-Type': 'application/json;charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-TOKEN': document
          .querySelector('meta[name="csrf-token"]')
          .getAttribute('content'),
        'X-XSRF-Token': parse(document.cookie)['XSRF-TOKEN']
      }
    })
  ).json();
  await browser.storage.sync.set({
    apiKey: data
  });
  alert('Convert Download has gotten its access token!');
  window.close();
};
browser.storage.sync.get(['apiKey']).then(async ({ apiKey }) => {
  if (!apiKey) {
    await getNewToken();
  } else {
    const data = await (
      await fetch('/oauth/personal-access-tokens', {
        credentials: 'include',
        headers: {
          Accept: 'application/json, text/plain, */*',
          'Content-Type': 'application/json;charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          'X-CSRF-TOKEN': document
            .querySelector('meta[name="csrf-token"]')
            .getAttribute('content'),
          'X-XSRF-Token': parse(document.cookie)['XSRF-TOKEN']
        }
      })
    ).json();
    if (data.every((el: { id: string }) => el.id !== apiKey.token.id))
      getNewToken();
  }
});
