import 'core-js/stable';
import 'regenerator-runtime/runtime';
import io from 'socket.io-client';
import getSupportedFormats from './util/getSupportedFormats';
import { browser, Downloads, Notifications } from 'webextension-polyfill-ts';

const MAIN_ICON = './icons/icon-512x512.a56b07dc.png';
const API_BASE = 'https://api.cloudconvert.com/v2';
const WEBSOCKET_BASE = 'https://socketio.cloudconvert.com';
const waitUntilFinished = async (
  id: number
): Promise<Downloads.DownloadItem> => {
  const [item] = await browser.downloads.search({ id });
  if (item.state === 'complete') return item;
  else
    return new Promise<Downloads.DownloadItem>(resolve =>
      setTimeout(() => resolve(waitUntilFinished(id)), 100)
    );
};
browser.browserAction.setBadgeBackgroundColor({
  color: 'gray'
});

type PossiblyChromeDownloadItem = Downloads.DownloadItem & {
  finalUrl?: string;
};
interface PossiblyChromeCreateNotificationOptions extends Notifications.CreateNotificationOptions {
  buttons: Notifications.CreateNotificationOptionsButtonsItemType[]
}

const downloadHandler = (item: PossiblyChromeDownloadItem, filename: string): void => {
  const ext = filename.slice(filename.lastIndexOf('.') + 1).toLocaleLowerCase();
  browser.storage.local.get([ext]).then(({ [ext]: content }) => {
    if (typeof content === 'undefined') {
      getSupportedFormats(ext).then(vals => {
        if (vals.length === 0) return;
        const notifId = item.id.toString(36);
        browser.notifications.create(notifId, {
          title: `${ext.toLocaleUpperCase()} file conversion`,
          type: 'basic',
          message: `Should files with the .${ext} extension be automatically converted?`,
          contextMessage: `${filename}`,
          iconUrl: MAIN_ICON,
          buttons: [
            {
              title: 'Configure'
            },
            {
              title: 'No'
            }
          ]
        } as PossiblyChromeCreateNotificationOptions);
        const noAction = (): void => {
          browser.storage.local.set({
            [ext]: {
              disabled: true
            }
          });
        };
        const configure = (): void => {
          browser.storage.local
            .set({
              recommendedOption: ext
            })
            .then(() => browser.runtime.openOptionsPage());
        };
        const onButtonClicked = (id: string, ind: number): void => {
          if (id === notifId) {
            if (ind === 0) configure();
            else noAction();
          }
        };
        browser.notifications.onClosed.addListener(id =>
          onButtonClicked(id, 1)
        );
        browser.notifications.onButtonClicked.addListener(onButtonClicked);
        browser.notifications.onClicked.addListener(id =>
          onButtonClicked(id, 0)
        );
      });
    } else {
      if (content.disabled) return;
      browser.storage.sync.get(['apiKey']).then(({ apiKey }) => {
        if (apiKey) {
          const token = apiKey.accessToken;
          browser.browserAction.setBadgeText({
            text: '...'
          });
          if (content.removeOrig) {
            browser.downloads.cancel(item.id);
            browser.downloads.erase({
              id: item.id
            });
          }
          fetch(`${API_BASE}/jobs`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
              Accept: 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
              tasks: {
                importFile: {
                  operation: 'import/url',
                  url: item.finalUrl || item.url,
                  filename
                },
                convert: {
                  operation: 'convert',
                  input: 'importFile',
                  input_format: ext,
                  output_format: content.convertTo
                },
                exportFile: {
                  operation: 'export/url',
                  input: 'convert'
                }
              }
            })
          })
            .then(res => res.json())
            .then(val => {
              const socket = io(WEBSOCKET_BASE);
              socket.emit('subscribe', {
                channel: `private-job.${val.data.id}`,
                auth: {
                  headers: {
                    Authorization: `Bearer ${token}`
                  }
                }
              });
              socket.on(
                'job.finished',
                (
                  channel: string,
                  data: {
                    job: {
                      tasks: {
                        operation: string;
                        result: { files: { url: string }[] };
                      }[];
                    };
                  }
                ) => {
                  browser.downloads
                    .download({
                      url: data.job.tasks.find(
                        (el: { operation: string }) =>
                          el.operation === 'export/url'
                      ).result.files[0].url
                    })
                    .then(
                      () => '✔️',
                      () => '❌'
                    )
                    .then(text => {
                      browser.browserAction.setBadgeText({
                        text
                      });
                      setTimeout(
                        () =>
                          browser.browserAction.setBadgeText({
                            text: ''
                          }),
                        5000
                      );
                    });
                }
              );
              const fallbackDownload = (downloadId: number): Promise<void> =>
                waitUntilFinished(downloadId).then(item => {
                  const xhr = new XMLHttpRequest();
                  xhr.open('GET', `file://${item.filename}`, true);
                  xhr.addEventListener('load', () => {
                    const blob = xhr.response;
                    fetch(`${API_BASE}/jobs`, {
                      method: 'POST',
                      headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        Accept: 'application/json'
                      },
                      body: JSON.stringify({
                        tasks: {
                          importFile: {
                            operation: 'import/upload'
                          },
                          convert: {
                            operation: 'convert',
                            input: 'importFile',
                            input_format: ext,
                            output_format: content.convertTo
                          },
                          exportFile: {
                            operation: 'export/url',
                            input: 'convert'
                          }
                        }
                      })
                    })
                      .then(res => res.json())
                      .then(val => {
                        const id = val.data.id;
                        const uploadForm = val.data.tasks.find(
                          (el: { operation: string }) =>
                            el.operation === 'import/upload'
                        ).result.form;
                        const formURL = uploadForm.url;
                        const formData = new FormData();
                        for (const k in uploadForm.parameters) {
                          formData.append(k, uploadForm.parameters[k]);
                        }
                        formData.append('file', blob, filename);
                        const socket = io(WEBSOCKET_BASE);
                        socket.emit('subscribe', {
                          channel: `private-job.${id}`,
                          auth: {
                            headers: {
                              Authorization: `Bearer ${token}`
                            }
                          }
                        });
                        socket.on(
                          'job.finished',
                          (
                            channel: string,
                            data: {
                              job: {
                                tasks: {
                                  operation: string;
                                  result: { files: { url: string }[] };
                                }[];
                              };
                            }
                          ) => {
                            browser.downloads
                              .download({
                                url: data.job.tasks.find(
                                  (el: { operation: string }) =>
                                    el.operation === 'export/url'
                                ).result.files[0].url
                              })
                              .then(
                                () => '✔️',
                                () => '❌'
                              )
                              .then(text => {
                                browser.browserAction.setBadgeText({
                                  text
                                });
                                setTimeout(
                                  () =>
                                    browser.browserAction.setBadgeText({
                                      text: ''
                                    }),
                                  5000
                                );
                              });
                            if (content.removeOrig)
                              browser.downloads.removeFile(item.id);
                              browser.downloads.erase({
                                id: item.id
                              });
                          }
                        );
                        socket.on(
                          'job.failed',
                          (channel: string, data: unknown) => {
                            console.log(data);
                            browser.browserAction.setBadgeText({
                              text: '❌'
                            });
                            setTimeout(
                              () =>
                                browser.browserAction.setBadgeText({
                                  text: ''
                                }),
                              5000
                            );
                          }
                        );
                        fetch(formURL, { method: 'POST', body: formData });
                      });
                  });
                  xhr.responseType = 'blob';
                  xhr.send();
                });
              socket.on('job.failed', () => {
                browser.permissions
                  .request({
                    origins: ['file://*']
                  })
                  .then(granted => {
                    if (granted) {
                      if (content.removeOrig)
                        browser.downloads
                          .download({
                            url: item.url
                          })
                          .then(downloadId => {
                            fallbackDownload(downloadId);
                          });
                      else fallbackDownload(item.id);
                    } else {
                      browser.browserAction.setBadgeText({
                        text: '❌'
                      });
                      setTimeout(
                        () =>
                          browser.browserAction.setBadgeText({
                            text: ''
                          }),
                        5000
                      );
                    }
                  });
              });
            });
        }
      });
    }
  });
}

const parseFilename = (fn: string): string => fn.split('\\').pop().split('/').pop();
declare const chrome: {
  downloads: {
    onDeterminingFilename: typeof browser.downloads.onCreated
  }
} | undefined;
let evt = browser.downloads.onCreated;
if (typeof chrome !== 'undefined') evt = chrome.downloads.onDeterminingFilename;
evt.addListener((item: PossiblyChromeDownloadItem) => {
  if (item.byExtensionId === browser.runtime.id) return;
  let filename = item.filename;
  if (!filename)
    browser.downloads.onChanged.addListener(({ id, filename: fn }) => {
      if (id === item.id && fn && fn.previous !== fn.current) {
        downloadHandler(item, parseFilename(fn.current));
      }
    });
  else downloadHandler(item, parseFilename(filename));
});
