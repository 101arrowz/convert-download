import { render } from 'react-dom';

export default (App: React.ReactElement): void =>
  void render(App, document.getElementById('root'));
