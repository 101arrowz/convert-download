import React from 'react';

const Popup: React.FC = () => {
  return (
    <button onClick={() => {
      window.open(
        'https://cloudconvert.com/dashboard/api/v2/keys',
        'CloudConvert API Keys',
        'resizable'
      );
    }}>Open API Page</button>
  )
}
export default Popup;