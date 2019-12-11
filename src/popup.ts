document.querySelector('#help').addEventListener('click', () => {
  const ccWindow = window.open('https://cloudconvert.com/dashboard/api/v2/keys', 'CloudConvert API Keys', 'resizable') as Window & { openedBy: Window };
  ccWindow.openedBy = window;
})