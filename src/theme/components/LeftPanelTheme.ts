export interface LeftPanelTheme {
  background: string;
  border: string;
  header: {
    background: string;
    text: string;
  };
  section: {
    border: string;
    header: {
      text: string;
    };
  };
  select: {
    background: string;
    hover: string;
    text: string;
    option: {
      background: string;
      hover: string;
      text: string;
    };
  };
  button: {
    background: string;
    hover: string;
    text: string;
    icon: string;
  };
  nodeButton: {
    text: string;
  };
  projectButton: {
    background: string;
    hover: string;
    text: string;
    icon: string;
  };
}

export const getLeftPanelTheme = (): LeftPanelTheme => {
  return {
    background: "#0D0D0F",
    border: "rgba(55, 65, 81, 0.5)",
    header: {
      background: "transparent",
      text: "rgba(107, 114, 128, 1)",
    },
    section: {
      border: "rgba(55, 65, 81, 0.5)",
      header: {
        text: "rgba(107, 114, 128, 1)",
      },
    },
    select: {
      background: "rgba(30, 58, 138, 0.2)",
      hover: "rgba(30, 58, 138, 0.3)",
      text: "rgba(209, 213, 219, 1)",
      option: {
        background: "rgba(23, 23, 26, 1)",
        hover: "rgba(30, 30, 34, 1)",
        text: "rgba(255, 255, 255, 0.9)",
      },
    },
    button: {
      background: "rgba(31, 41, 55, 0.4)",
      hover: "rgba(31, 41, 55, 0.6)",
      text: "rgba(209, 213, 219, 1)",
      icon: "rgba(156, 163, 175, 1)",
    },
    nodeButton: {
      text: "rgba(209, 213, 219, 1)",
    },
    projectButton: {
      background: "rgba(31, 41, 55, 0.5)",
      hover: "rgba(55, 65, 81, 0.7)",
      text: "rgba(209, 213, 219, 1)",
      icon: "rgba(156, 163, 175, 1)",
    },
  };
};
