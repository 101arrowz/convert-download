declare global {
  interface BackgroundWindow extends Window {
    recommendedOption?: string;
  }
  interface APIPageWindow extends Window {
    opened?: true;
  }
}

export {}