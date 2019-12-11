const MAIN_ICON = './icons/icon-512x512.a56b07dc.png';
chrome.downloads.onDeterminingFilename.addListener(item => {
  const urlStr = item.finalUrl;
  const url = new URL(urlStr);
  const filename = urlStr.slice(urlStr.lastIndexOf('/')+1);
  const ext = filename.slice(filename.lastIndexOf('.')+1);
  chrome.storage.sync.get([ext], ({ ext: content }) => {
    if (chrome.runtime.lastError || !content) {
      chrome.downloads.cancel(item.id);
      chrome.notifications.create(urlStr, {
        title: `${ext.toLocaleUpperCase()} file conversion`,
        message: `Should files with the .${ext} extension be automatically converted?`,
        contextMessage: `${filename} was downloaded from ${url.hostname}.`,
        iconUrl: MAIN_ICON,
        buttons: [
          {
            title: 'Configure'
          },
          {
            title: 'No'
          }
        ],
      });
      const noAction = (): void => chrome.storage.sync.set({
        [ext]: null
      });
      const configure = (): void => {
        chrome.runtime.openOptionsPage();
      }
      const onButtonClicked = (id: string, ind: number): void => {
        if (id === urlStr) {
          if (ind === 0) configure();
          else noAction();
        }
      }
      chrome.notifications.onClosed.addListener(id => onButtonClicked(id, 1));
      chrome.notifications.onButtonClicked.addListener(onButtonClicked);
      chrome.notifications.onClicked.addListener(id => onButtonClicked(id, 0));
    }
  })
})