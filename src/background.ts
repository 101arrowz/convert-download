import io from 'socket.io-client';
import getSupportedFormats from './util/getSupportedFormats';

const MAIN_ICON = './icons/icon-512x512.a56b07dc.png';
const API_BASE = 'https://api.cloudconvert.com/v2';
const WEBSOCKET_BASE = 'https://socketio.cloudconvert.com';
const waitUntilFinished = (
  id: number
): Promise<chrome.downloads.DownloadItem> =>
  new Promise<chrome.downloads.DownloadItem>(resolve =>
    chrome.downloads.search({ id }, results => resolve(results[0]))
  ).then(item => {
    if (item.state === 'complete') return item;
    else
      return new Promise<chrome.downloads.DownloadItem>(resolve =>
        setTimeout(() => resolve(waitUntilFinished(id)), 100)
      );
  });
chrome.browserAction.setBadgeBackgroundColor({
  color: 'gray'
});
chrome.downloads.onDeterminingFilename.addListener(item => {
  if (item.byExtensionId === chrome.runtime.id) return;
  const filename = item.filename;
  const ext = filename.slice(filename.lastIndexOf('.') + 1).toLocaleLowerCase();
  chrome.storage.local.get([ext], ({ [ext]: content }) => {
    if (chrome.runtime.lastError || typeof content === 'undefined') {
      getSupportedFormats(ext).then(vals => {
        if (vals.length === 0) return;
        const notifId = item.id.toString(36);
        chrome.notifications.create(notifId, {
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
        });
        const noAction = (): void => {
          chrome.storage.local.set({
            [ext]: {
              disabled: true
            }
          });
        };
        const configure = (): void => {
          chrome.storage.local.set(
            {
              recommendedOption: ext
            },
            () => chrome.runtime.openOptionsPage()
          );
        };
        const onButtonClicked = (id: string, ind: number): void => {
          if (id === notifId) {
            if (ind === 0) configure();
            else noAction();
          }
        };
        chrome.notifications.onClosed.addListener(id => onButtonClicked(id, 1));
        chrome.notifications.onButtonClicked.addListener(onButtonClicked);
        chrome.notifications.onClicked.addListener(id =>
          onButtonClicked(id, 0)
        );
      });
    } else {
      if (content.disabled) return;
      chrome.storage.sync.get(['apiKey'], ({ apiKey }) => {
        if (apiKey && !chrome.runtime.lastError) {
          const token = apiKey.accessToken;
          chrome.browserAction.setBadgeText({
            text: '...'
          });
          if (content.removeOrig) chrome.downloads.cancel(item.id);
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
                  url: item.finalUrl,
                  filename: item.filename
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
                  chrome.downloads.download(
                    {
                      url: data.job.tasks.find(
                        (el: { operation: string }) =>
                          el.operation === 'export/url'
                      ).result.files[0].url
                    },
                    () => {
                      chrome.browserAction.setBadgeText({
                        text: chrome.runtime.lastError ? '❌' : '✔️'
                      });
                      setTimeout(
                        () =>
                          chrome.browserAction.setBadgeText({
                            text: ''
                          }),
                        5000
                      );
                    }
                  );
                }
              );
              const fallbackDownload = (downloadId: number) =>
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
                            chrome.downloads.download(
                              {
                                url: data.job.tasks.find(
                                  (el: { operation: string }) =>
                                    el.operation === 'export/url'
                                ).result.files[0].url
                              },
                              () => {
                                chrome.browserAction.setBadgeText({
                                  text: chrome.runtime.lastError ? '❌' : '✔️'
                                });
                                setTimeout(
                                  () =>
                                    chrome.browserAction.setBadgeText({
                                      text: ''
                                    }),
                                  5000
                                );
                              }
                            );
                            if (content.removeOrig)
                              chrome.downloads.removeFile(item.id);
                          }
                        );
                        socket.on(
                          'job.failed',
                          (channel: string, data: unknown) => {
                            console.log(data);
                            chrome.browserAction.setBadgeText({
                              text: '❌'
                            });
                            setTimeout(
                              () =>
                                chrome.browserAction.setBadgeText({
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
              socket.on('job.failed', (channel: string, data: unknown) => {
                chrome.permissions.request(
                  {
                    origins: ['file://*']
                  },
                  granted => {
                    if (granted) {
                      if (content.removeOrig)
                        chrome.downloads.download(
                          {
                            url: item.url
                          },
                          downloadId => {
                            fallbackDownload(downloadId);
                          }
                        );
                      else fallbackDownload(item.id);
                    } else {
                      chrome.browserAction.setBadgeText({
                        text: 'FAIL'
                      });
                      setTimeout(
                        () =>
                          chrome.browserAction.setBadgeText({
                            text: ''
                          }),
                        5000
                      );
                    }
                  }
                );
              });
            });
        }
      });
    }
  });
});
