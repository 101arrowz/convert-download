import { parse } from 'cookie';
declare const window: APIPageWindow;
const getNewToken = (): void => {
  fetch('/oauth/personal-access-tokens', {
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
    .then(res => res.json())
    .then(res => {
      chrome.storage.sync.set({
        apiKey: res
      });
      alert('Convert Download has gotten its access token!');
      window.close();
    });
};
chrome.storage.sync.get(['apiKey'], ({ apiKey }) => {
  if (chrome.runtime.lastError || !apiKey) {
    getNewToken();
  } else {
    fetch('/oauth/personal-access-tokens', {
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
      .then(res => res.json())
      .then(data => {
        if (data.every((el: { id: string }) => el.id !== apiKey.token.id)) {
          getNewToken();
        }
      });
  }
});
